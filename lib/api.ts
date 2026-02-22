type InflightEntry = {
  controller: AbortController;
  promise: Promise<unknown>;
};

const inflight = new Map<string, InflightEntry>();

export async function fetchJson<T>(key: string, url: string): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    return existing.promise as Promise<T>;
  }

  const controller = new AbortController();
  const promise = fetch(url, { signal: controller.signal }).then(async (res) => {
    const payload = await res.json();
    if (!res.ok) {
      const message =
        typeof payload?.message === "string"
          ? payload.message
          : "Request failed";
      throw new Error(message);
    }
    return payload as T;
  });

  inflight.set(key, { controller, promise });

  try {
    return (await promise) as T;
  } finally {
    inflight.delete(key);
  }
}

export function abortFetch(key: string) {
  const entry = inflight.get(key);
  if (entry) {
    entry.controller.abort();
    inflight.delete(key);
  }
}
