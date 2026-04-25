import type {
  Company,
  Eta,
  EtaDb,
  RouteListEntry,
  StopListEntry,
} from "hk-bus-eta";

import type { BUS_COMPANIES } from "@/lib/hkbus/constants";

export type BusCompany = (typeof BUS_COMPANIES)[number];

export type Language = "en" | "zh";

export type RouteRecord = {
  id: string;
  route: string;
  serviceType: string;
  companies: BusCompany[];
  origin: {
    en: string;
    zh: string;
  };
  destination: {
    en: string;
    zh: string;
  };
  totalStopsByCompany: Partial<Record<BusCompany, number>>;
};

export type RouteStopRecord = {
  sequence: number;
  stopId: string;
  company: BusCompany;
  name: {
    en: string;
    zh: string;
  };
  location: {
    lat: number;
    lng: number;
  };
};

export type EtaRecord = {
  eta: string;
  isoEta: string;
  company: BusCompany;
  destination: {
    en: string;
    zh: string;
  };
  remark: {
    en: string;
    zh: string;
  };
  minutes: number | null;
};

export type RawRoute = {
  routeId: string;
  route: RouteListEntry;
};

export type EtaDbCacheSnapshot = {
  md5: string | null;
  loadedAt: string | null;
  expiresAt: string | null;
  routeCount: number;
  stopCount: number;
};

export type EtaDbResolved = {
  db: EtaDb;
  md5: string | null;
  loadedAt: number;
  expiresAt: number;
};

export type EtaDbInternals = {
  db: EtaDb | null;
  md5: string | null;
  loadedAt: number;
  expiresAt: number;
  lastMd5CheckAt: number;
};

export type EtaCacheEntry = {
  key: string;
  value: EtaRecord[];
  expiresAt: number;
};

export type HkBusClient = {
  fetchEtaDb: () => Promise<EtaDb>;
  fetchEtaDbMd5: () => Promise<string>;
  fetchEtas: (input: RouteListEntry & {
    stopList?: EtaDb["stopList"];
    holidays?: EtaDb["holidays"];
    serviceDayMap?: EtaDb["serviceDayMap"];
    language: Language;
    seq: number;
  }) => Promise<Eta[]>;
};

export type { Company, Eta, EtaDb, RouteListEntry, StopListEntry };
