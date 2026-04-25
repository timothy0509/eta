import { describe, expect, test } from "bun:test";

import {
  isBusOperator,
  searchBusRoutes,
  toBusRouteRecords,
  toEtaRecords,
  toRouteStops,
} from "@/lib/hkbus/normalize";
import type { Eta } from "hk-bus-eta";
import type { EtaDb } from "@/lib/hkbus/types";

const sampleDb: EtaDb = {
  holidays: [],
  serviceDayMap: {},
  routeList: {
    "1+1+A+B": {
      route: "1",
      co: ["kmb"],
      orig: { en: "A", zh: "甲" },
      dest: { en: "B", zh: "乙" },
      fares: null,
      faresHoliday: null,
      freq: null,
      jt: null,
      seq: 2,
      serviceType: "1",
      stops: {
        kmb: ["S1", "S2"],
      } as unknown as EtaDb["routeList"][string]["stops"],
      bound: {
        kmb: "O",
      } as unknown as EtaDb["routeList"][string]["bound"],
      gtfsId: "",
      nlbId: "",
    },
    "N2+1+C+D": {
      route: "N2",
      co: ["mtr"],
      orig: { en: "C", zh: "丙" },
      dest: { en: "D", zh: "丁" },
      fares: null,
      faresHoliday: null,
      freq: null,
      jt: null,
      seq: 1,
      serviceType: "1",
      stops: {
        mtr: ["S3"],
      } as unknown as EtaDb["routeList"][string]["stops"],
      bound: {
        mtr: "O",
      } as unknown as EtaDb["routeList"][string]["bound"],
      gtfsId: "",
      nlbId: "",
    },
  },
  stopList: {
    S1: {
      location: { lat: 22.3, lng: 114.1 },
      name: { en: "Stop 1", zh: "站1" },
    },
    S2: {
      location: { lat: 22.4, lng: 114.2 },
      name: { en: "Stop 2", zh: "站2" },
    },
    S3: {
      location: { lat: 22.5, lng: 114.3 },
      name: { en: "Stop 3", zh: "站3" },
    },
  },
  stopMap: {},
};

describe("hkbus normalize", () => {
  test("toBusRouteRecords filters non-bus routes", () => {
    const routes = toBusRouteRecords(sampleDb);
    expect(routes).toHaveLength(1);
    expect(routes[0].id).toBe("1+1+A+B");
    expect(routes[0].companies).toEqual(["kmb"]);
  });

  test("searchBusRoutes applies query and limit", () => {
    const routes = toBusRouteRecords(sampleDb);

    const byQuery = searchBusRoutes(routes, { query: "甲" });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0].route).toBe("1");

    const byLimit = searchBusRoutes(routes, { limit: 1 });
    expect(byLimit).toHaveLength(1);
  });

  test("toRouteStops maps stop sequence", () => {
    const route = sampleDb.routeList["1+1+A+B"];
    const stops = toRouteStops(sampleDb, { routeId: "1+1+A+B", route }, "kmb");

    expect(stops).toHaveLength(2);
    expect(stops[0]).toMatchObject({ sequence: 0, stopId: "S1", company: "kmb" });
    expect(stops[1]).toMatchObject({ sequence: 1, stopId: "S2", company: "kmb" });
  });

  test("toEtaRecords computes minutes and keeps bus-only ETAs", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const etas: Eta[] = [
      {
        eta: "2026-01-01T00:03:00.000Z",
        remark: { en: "", zh: "" },
        dest: { en: "B", zh: "乙" },
        co: "kmb",
      },
      {
        eta: "2026-01-01T00:05:00.000Z",
        remark: { en: "", zh: "" },
        dest: { en: "D", zh: "丁" },
        co: "mtr",
      },
    ];

    const records = toEtaRecords(etas, now);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ company: "kmb", minutes: 3 });
  });

  test("isBusOperator returns expected values", () => {
    expect(isBusOperator("kmb")).toBe(true);
    expect(isBusOperator("mtr")).toBe(false);
  });
});
