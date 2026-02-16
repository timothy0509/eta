import { fetchEtaDb, fetchEtas } from "hk-bus-eta";
import type { EtaDb } from "hk-bus-eta";

const CACHE_TTL_MS = 30 * 60 * 1000;

let etaDbCache: {
  value: EtaDb | null;
  expiresAt: number;
  inflight?: Promise<EtaDb>;
} = {
  value: null,
  expiresAt: 0,
};

export async function getEtaDb(): Promise<EtaDb> {
  const now = Date.now();
  if (etaDbCache.value && etaDbCache.expiresAt > now) {
    return etaDbCache.value;
  }

  if (etaDbCache.inflight) {
    return etaDbCache.inflight;
  }

  etaDbCache.inflight = fetchEtaDb()
    .then((data) => {
      etaDbCache.value = data;
      etaDbCache.expiresAt = Date.now() + CACHE_TTL_MS;
      etaDbCache.inflight = undefined;
      return data;
    })
    .catch((error) => {
      etaDbCache.inflight = undefined;
      throw error;
    });

  return etaDbCache.inflight;
}

export const getEtas = fetchEtas;
