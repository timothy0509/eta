export type TransportMode = "kmb" | "mtr" | "lrt";

export type UiLanguage = "en" | "tc" | "sc";

export function isLanguageSupported(mode: TransportMode, lang: UiLanguage) {
  if (lang === "sc") return mode === "kmb";
  return true;
}

export function defaultLanguageForMode(mode: TransportMode): UiLanguage {
  return mode === "kmb" ? "tc" : "tc";
}

export type KmbStopSearchItem = {
  stopId: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
  lat: number;
  lng: number;
};

export type LrtStationSearchItem = {
  stationId: string;
  nameEn: string;
  nameZh: string;
};

export type MtrStationSearchItem = {
  labelId: string; // stable id for merged stations
  sta: string; // used for API requests
  lines: string[]; // all lines serving this station
  nameEn: string;
  nameTc: string;
};
