export type FetchJsonOptions = {
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<T> {
  const response = await fetch(url, {
    cache: options.cache,
    next: options.next,
    signal: options.signal,
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new ApiError(
      `HTTP ${response.status} from upstream${bodyText ? `: ${bodyText}` : ""}`,
      response.status
    );
  }

  return (await response.json()) as T;
}
