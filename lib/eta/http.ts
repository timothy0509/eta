export type FetchJsonOptions = {
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  signal?: AbortSignal;
  timeoutMs?: number;
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

  // Avoid returning HTML/error pages directly to clients.
  if (trimmed.startsWith("<") || trimmed.toLowerCase().includes("<html")) {
    return "";
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed;
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 12_000;
  const timeout = timeoutMs
    ? setTimeout(() => controller.abort(new UpstreamTimeoutError()), timeoutMs)
    : null;

  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(url, {
      cache: options.cache,
      next: options.next,
      signal,
      headers: {
        accept: "application/json",
      },
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
