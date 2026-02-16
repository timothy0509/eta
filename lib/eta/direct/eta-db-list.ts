import { CACHE_POLICIES } from "@/lib/eta/cache/policy";
import { ETA_DB_CACHE_KEY, ETA_DB_MD5_KEY } from "@/lib/eta/cache/keys";
import { idbGet, idbSet } from "@/lib/eta/cache/idb";
import { createMetaForPolicy, isFresh } from "@/lib/eta/cache/policy";
import { fetchEtaDb, fetchEtaDbMd5 } from "hk-bus-eta";

import type { EtaDb } from "hk-bus-eta";

export type EtaDbCacheValue = {
  db: EtaDb;
  md5: string;
  fetchedAt: number;
};

export async function getEtaDbSnapshot(): Promise<EtaDbCacheValue> {
  const cached = await idbGet<EtaDbCacheValue>(ETA_DB_CACHE_KEY);
  const cachedMd5 = await idbGet<string>(ETA_DB_MD5_KEY);

  if (cached && isFresh(cached) && cachedMd5?.value) {
    return cached.value;
  }

  const [db, md5] = await Promise.all([fetchEtaDb(), fetchEtaDbMd5()]);
  const payload = { db, md5, fetchedAt: Date.now() };
  const meta = createMetaForPolicy(CACHE_POLICIES.etaDb);
  await idbSet(ETA_DB_CACHE_KEY, { value: payload, ...meta });
  await idbSet(ETA_DB_MD5_KEY, { value: md5, ...meta });
  return payload;
}
