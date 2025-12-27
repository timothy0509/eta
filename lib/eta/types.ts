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
  line: string;
  sta: string;
  nameEn: string;
  nameTc: string;
};
