import { describe, expect, test } from "bun:test";

import {
  etaQuerySchema,
  routeSearchQuerySchema,
  routeStopsQuerySchema,
} from "@/lib/validation/hkbus";

describe("hkbus validation", () => {
  test("routeSearchQuerySchema parses defaults", () => {
    const parsed = routeSearchQuerySchema.parse({});
    expect(parsed.limit).toBe(20);
  });

  test("routeSearchQuerySchema validates operator", () => {
    expect(() => routeSearchQuerySchema.parse({ operator: "mtr" })).toThrow();
    const parsed = routeSearchQuerySchema.parse({ operator: "kmb" });
    expect(parsed.operator).toBe("kmb");
  });

  test("routeStopsQuerySchema requires operator", () => {
    expect(() => routeStopsQuerySchema.parse({})).toThrow();
  });

  test("etaQuerySchema parses values", () => {
    const parsed = etaQuerySchema.parse({
      routeId: "1+1+A+B",
      operator: "kmb",
      seq: "0",
      lang: "zh",
    });

    expect(parsed).toEqual({
      routeId: "1+1+A+B",
      operator: "kmb",
      seq: 0,
      lang: "zh",
    });
  });
});
