import { create } from "zustand";
import { fetchJson } from "@/lib/api";
import type {
  BusCompany,
  BusEta,
  BusRouteSummary,
  BusStopData,
  MtrResponse,
} from "@/lib/types";

export type LoadStatus = "idle" | "loading" | "error";
export type Mode = "bus" | "mtr";

type EtaState = {
  mode: Mode;
  language: "en" | "tc";
  timeMode: "countdown" | "exact";

  busQuery: string;
  busRoutes: BusRouteSummary[];
  busRouteStatus: LoadStatus;
  selectedRoute: BusRouteSummary | null;
  busStopData: BusStopData | null;
  stopPreference: BusCompany | null;
  selectedStopSeq: number | null;
  busEtas: BusEta[];
  busEtaStatus: LoadStatus;

  mtrLine: string;
  mtrStation: string;
  mtrResponse: MtrResponse | null;
  mtrStatus: LoadStatus;

  lastBusFetchAt: number | null;
  lastMtrFetchAt: number | null;
};

type EtaActions = {
  setMode: (mode: Mode) => void;
  setLanguage: (lang: "en" | "tc") => void;
  setTimeMode: (mode: "countdown" | "exact") => void;

  setBusQuery: (query: string) => void;
  resetBusSelection: () => void;
  searchRoutes: (query: string) => Promise<void>;
  selectRoute: (route: BusRouteSummary) => void;
  loadStops: (routeId: string) => Promise<void>;
  setStopPreference: (company: BusCompany) => void;
  setSelectedStopSeq: (seq: number | null) => void;
  loadBusEtas: (routeId: string, seq: number) => Promise<void>;

  setMtrLine: (line: string) => void;
  setMtrStation: (station: string) => void;
  loadMtr: (line: string, station: string) => Promise<void>;
};

const initialState: EtaState = {
  mode: "bus",
  language: "en",
  timeMode: "countdown",

  busQuery: "",
  busRoutes: [],
  busRouteStatus: "idle",
  selectedRoute: null,
  busStopData: null,
  stopPreference: null,
  selectedStopSeq: null,
  busEtas: [],
  busEtaStatus: "idle",

  mtrLine: "",
  mtrStation: "",
  mtrResponse: null,
  mtrStatus: "idle",

  lastBusFetchAt: null,
  lastMtrFetchAt: null,
};

export const useEtaStore = create<EtaState & EtaActions>((set, get) => ({
  ...initialState,
  setMode: (mode) => set({ mode }),
  setLanguage: (language) => set({ language }),
  setTimeMode: (timeMode) => set({ timeMode }),

  setBusQuery: (busQuery) => set({ busQuery }),
  resetBusSelection: () =>
    set({
      selectedRoute: null,
      busStopData: null,
      stopPreference: null,
      selectedStopSeq: null,
      busEtas: [],
      busEtaStatus: "idle",
    }),
  searchRoutes: async (query) => {
    const language = get().language;
    if (get().busRouteStatus === "loading") return;
    if (!query.trim()) {
      set({ busRoutes: [], busRouteStatus: "idle" });
      return;
    }

    set({ busRouteStatus: "loading" });
    try {
      const key = `bus-search-${language}-${query}`;
      const url = `/api/bus?action=search&query=${encodeURIComponent(
        query,
      )}&lang=${language}`;
      const payload = await fetchJson<{ routes: BusRouteSummary[] }>(key, url);
      set({ busRoutes: payload.routes ?? [], busRouteStatus: "idle" });
    } catch (error) {
      set({ busRouteStatus: "error" });
    }
  },
  selectRoute: (route) =>
    set({
      selectedRoute: route,
      busStopData: null,
      selectedStopSeq: null,
      busEtas: [],
      busEtaStatus: "idle",
    }),
  loadStops: async (routeId) => {
    const language = get().language;
    if (!routeId) return;
    const url = `/api/bus?action=stops&routeId=${encodeURIComponent(
      routeId,
    )}&lang=${language}`;

    try {
      const key = `bus-stops-${language}-${routeId}`;
      const payload = await fetchJson<BusStopData & { status: string }>(key, url);
      set({
        busStopData: payload,
        stopPreference: payload.isJoint
          ? "kmb"
          : payload.companies?.[0] ?? null,
      });
    } catch (error) {
      set({ busStopData: null });
    }
  },
  setStopPreference: (company) => set({ stopPreference: company }),
  setSelectedStopSeq: (seq) => set({ selectedStopSeq: seq, busEtas: [] }),
  loadBusEtas: async (routeId, seq) => {
    const language = get().language;
    if (get().busEtaStatus === "loading") return;
    set({ busEtaStatus: "loading" });
    try {
      const key = `bus-eta-${language}-${routeId}-${seq}`;
      const url = `/api/bus?action=eta&routeId=${encodeURIComponent(
        routeId,
      )}&seq=${seq}&lang=${language}`;
      const payload = await fetchJson<{ etas: BusEta[] }>(key, url);
      set({
        busEtas: payload.etas ?? [],
        busEtaStatus: "idle",
        lastBusFetchAt: Date.now(),
      });
    } catch (error) {
      set({ busEtaStatus: "error" });
    }
  },

  setMtrLine: (line) =>
    set({ mtrLine: line, mtrStation: "", mtrResponse: null }),
  setMtrStation: (station) => set({ mtrStation: station }),
  loadMtr: async (line, station) => {
    const language = get().language;
    if (get().mtrStatus === "loading") return;
    set({ mtrStatus: "loading" });
    try {
      const key = `mtr-${language}-${line}-${station}`;
      const url = `/api/mtr?line=${encodeURIComponent(
        line,
      )}&station=${encodeURIComponent(station)}&lang=${language}`;
      const payload = await fetchJson<MtrResponse>(key, url);
      set({
        mtrResponse: payload,
        mtrStatus: "idle",
        lastMtrFetchAt: Date.now(),
      });
    } catch (error) {
      set({ mtrStatus: "error" });
    }
  },
}));
