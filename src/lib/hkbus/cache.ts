import {
  ETA_DB_MD5_CHECK_INTERVAL_MS,
  ETA_DB_TTL_MS,
  ETA_RESPONSE_TTL_MS,
} from "@/lib/hkbus/constants";
import { hkBusClient } from "@/lib/hkbus/client";
import type {
  EtaCacheEntry,
  EtaDbCacheSnapshot,
  EtaDbInternals,
  EtaDbResolved,
  EtaRecord,
} from "@/lib/hkbus/types";

const dbState: EtaDbInternals = {
  db: null,
  md5: null,
  loadedAt: 0,
  expiresAt: 0,
  lastMd5CheckAt: 0,
};

const etaCache = new Map<string, EtaCacheEntry>();
let dbRefreshPromise: Promise<EtaDbResolved> | null = null;

function nowMs(): number {
  return Date.now();
}

function isDbFresh(now: number): boolean {
  return dbState.db !== null && now < dbState.expiresAt;
}

async function loadFreshDb(): Promise<EtaDbResolved> {
  const [db, md5] = await Promise.all([
    hkBusClient.fetchEtaDb(),
    hkBusClient.fetchEtaDbMd5().catch(() => ""),
  ]);

  const loadedAt = nowMs();
  dbState.db = db;
  dbState.md5 = md5 || null;
  dbState.loadedAt = loadedAt;
  dbState.expiresAt = loadedAt + ETA_DB_TTL_MS;
  dbState.lastMd5CheckAt = loadedAt;

  etaCache.clear();

  return {
    db,
    md5: dbState.md5,
    loadedAt,
    expiresAt: dbState.expiresAt,
  };
}

async function maybeRefreshWithMd5(): Promise<void> {
  if (!dbState.db) {
    return;
  }

  const now = nowMs();
  if (now - dbState.lastMd5CheckAt < ETA_DB_MD5_CHECK_INTERVAL_MS) {
    return;
  }

  dbState.lastMd5CheckAt = now;

  try {
    const md5 = await hkBusClient.fetchEtaDbMd5();
    if (md5 && dbState.md5 && md5 !== dbState.md5) {
      await loadFreshDb();
      return;
    }

    dbState.expiresAt = now + ETA_DB_TTL_MS;
  } catch {
    dbState.expiresAt = now + Math.floor(ETA_DB_TTL_MS / 3);
  }
}

export async function getEtaDbCached(): Promise<EtaDbResolved> {
  const now = nowMs();
  if (isDbFresh(now)) {
    void maybeRefreshWithMd5();
    return {
      db: dbState.db!,
      md5: dbState.md5,
      loadedAt: dbState.loadedAt,
      expiresAt: dbState.expiresAt,
    };
  }

  if (!dbRefreshPromise) {
    dbRefreshPromise = loadFreshDb().finally(() => {
      dbRefreshPromise = null;
    });
  }

  return dbRefreshPromise;
}

export function getEtaDbCacheSnapshot(): EtaDbCacheSnapshot {
  const routeCount = dbState.db ? Object.keys(dbState.db.routeList).length : 0;
  const stopCount = dbState.db ? Object.keys(dbState.db.stopList).length : 0;

  return {
    md5: dbState.md5,
    loadedAt: dbState.loadedAt ? new Date(dbState.loadedAt).toISOString() : null,
    expiresAt: dbState.expiresAt ? new Date(dbState.expiresAt).toISOString() : null,
    routeCount,
    stopCount,
  };
}

export function getEtaFromCache(key: string): EtaRecord[] | null {
  const entry = etaCache.get(key);
  if (!entry) {
    return null;
  }

  if (nowMs() >= entry.expiresAt) {
    etaCache.delete(key);
    return null;
  }

  return entry.value;
}

export function setEtaInCache(key: string, value: EtaRecord[]): void {
  etaCache.set(key, {
    key,
    value,
    expiresAt: nowMs() + ETA_RESPONSE_TTL_MS,
  });
}
