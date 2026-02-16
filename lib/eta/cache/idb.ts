export type IdbRecord<T> = {
  value: T;
  createdAt: number;
  expiresAt: number;
};

export type IdbOptions = {
  dbName?: string;
  storeName?: string;
  version?: number;
};

const DEFAULT_DB_NAME = "eta-cache";
const DEFAULT_STORE_NAME = "cache";
const DEFAULT_DB_VERSION = 1;

const dbPromises = new Map<string, Promise<IDBDatabase>>();

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function normalizeOptions(options?: IdbOptions) {
  return {
    dbName: options?.dbName ?? DEFAULT_DB_NAME,
    storeName: options?.storeName ?? DEFAULT_STORE_NAME,
    version: options?.version ?? DEFAULT_DB_VERSION,
  };
}

function getDbKey(options: { dbName: string; storeName: string; version: number }): string {
  return `${options.dbName}:${options.storeName}:${options.version}`;
}

function openDb(options: { dbName: string; storeName: string; version: number }) {
  const request = indexedDB.open(options.dbName, options.version);

  return new Promise<IDBDatabase>((resolve, reject) => {
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(options.storeName)) {
        db.createObjectStore(options.storeName);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDb(options: { dbName: string; storeName: string; version: number }) {
  const key = getDbKey(options);
  const existing = dbPromises.get(key);
  if (existing) return existing;
  const promise = openDb(options);
  dbPromises.set(key, promise);
  return promise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  options: IdbOptions | undefined,
  run: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const normalized = normalizeOptions(options);
  const db = await getDb(normalized);

  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(normalized.storeName, mode);
    const store = tx.objectStore(normalized.storeName);
    let result: Promise<T>;

    try {
      result = run(store);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }

    tx.oncomplete = () => {
      result.then(resolve).catch(reject);
    };
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export async function idbGet<T>(key: string, options?: IdbOptions): Promise<IdbRecord<T> | null> {
  if (!isIndexedDbAvailable()) return null;
  const record = await withStore("readonly", options, (store) => requestToPromise(store.get(key)));
  return (record as IdbRecord<T> | undefined) ?? null;
}

export async function idbSet<T>(
  key: string,
  record: IdbRecord<T>,
  options?: IdbOptions
): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  await withStore("readwrite", options, (store) => requestToPromise(store.put(record, key)));
  return true;
}

export async function idbDelete(key: string, options?: IdbOptions): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  await withStore("readwrite", options, (store) => requestToPromise(store.delete(key)));
  return true;
}

export async function idbClear(options?: IdbOptions): Promise<boolean> {
  if (!isIndexedDbAvailable()) return false;
  await withStore("readwrite", options, (store) => requestToPromise(store.clear()));
  return true;
}
