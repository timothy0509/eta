export type FetchJsonOptions = Omit<RequestInit, "signal" | "headers"> & {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: HeadersInit;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class UpstreamTimeoutError extends Error {
  constructor(message = "Upstream timeout") {
    super(message);
    this.name = "UpstreamTimeoutError";
  }
}

function sanitizeUpstreamBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("<") || trimmed.toLowerCase().includes("<html")) {
    return "";
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}

function mergeSignals(primary: AbortSignal, secondary: AbortSignal): AbortSignal {
  if (primary.aborted) return primary;
  if (secondary.aborted) return secondary;

  const controller = new AbortController();
  const onAbort = (signal: AbortSignal) => {
    controller.abort(signal.reason ?? new DOMException("Aborted", "AbortError"));
  };

  primary.addEventListener("abort", () => onAbort(primary), { once: true });
  secondary.addEventListener("abort", () => onAbort(secondary), { once: true });

  return controller.signal;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 12_000;
  const timeout = timeoutMs
    ? setTimeout(() => controller.abort(new UpstreamTimeoutError()), timeoutMs)
    : null;

  const mergedSignal = options.signal
    ? mergeSignals(options.signal, controller.signal)
    : controller.signal;

  const headers = new Headers(options.headers);
  if (!headers.has("accept")) {
    headers.set("accept", "application/json");
  }

  const { timeoutMs: _timeoutMs, signal: _signal, headers: _headers, ...rest } = options;

  try {
    const response = await fetch(url, {
      ...rest,
      signal: mergedSignal,
      headers,
    });

    if (!response.ok) {
      const bodyText = sanitizeUpstreamBody(await response.text().catch(() => ""));
      throw new ApiError(
        `HTTP ${response.status} from upstream${bodyText ? `: ${bodyText}` : ""}`,
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new UpstreamTimeoutError();
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
