import {
  fetchEtaDb as hkFetchEtaDb,
  fetchEtaDbMd5 as hkFetchEtaDbMd5,
  fetchEtas as hkFetchEtas,
} from "hk-bus-eta";

import type { HkBusClient } from "@/lib/hkbus/types";

export const hkBusClient: HkBusClient = {
  fetchEtaDb: hkFetchEtaDb,
  fetchEtaDbMd5: hkFetchEtaDbMd5,
  fetchEtas: hkFetchEtas,
};
