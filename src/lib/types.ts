export type Language = "zh" | "en";
export type Theme = "light" | "dark";
export type Density = "compact" | "balanced" | "spacious";
export type Mode = "route" | "stop" | "nearby";

export type NameText = {
  zh: string;
  en: string;
};

export type RouteListEntry = {
  route: string;
  co: string[];
  orig: NameText;
  dest: NameText;
  fares: string[] | null;
  faresHoliday: string[] | null;
  freq: Record<string, Record<string, [string, string] | null>> | null;
  jt: string | null;
  seq: number;
  serviceType: string;
  stops: Record<string, string[]>;
  bound: Record<string, "O" | "I" | "OI" | "IO">;
  gtfsId: string;
  nlbId: string;
};

export type StopListEntry = {
  location: {
    lat: number;
    lng: number;
  };
  name: NameText;
};

export type EtaDbPayload = {
  holidays: string[];
  routeList: Record<string, RouteListEntry>;
  stopList: Record<string, StopListEntry>;
};

export type Eta = {
  eta: string;
  remark: NameText;
  co: string;
};

export type EtaQuery = {
  routeId: string;
  company: string;
  seq: number;
};

export type StopRoute = {
  routeId: string;
  company: string;
  seq: number;
  route: string;
  orig: NameText;
  dest: NameText;
  bound: string;
  serviceType: string;
};

export type LocationPoint = {
  lat: number;
  lng: number;
};
