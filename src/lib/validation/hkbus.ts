import { z } from "zod";

import {
  BUS_COMPANIES,
  DEFAULT_ROUTE_SEARCH_LIMIT,
  MAX_ROUTE_SEARCH_LIMIT,
  SUPPORTED_LANGUAGES,
} from "@/lib/hkbus/constants";

export const companySchema = z.enum(BUS_COMPANIES);
export const languageSchema = z.enum(SUPPORTED_LANGUAGES);

export const routeSearchQuerySchema = z.object({
  query: z.string().trim().optional(),
  operator: companySchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_ROUTE_SEARCH_LIMIT)
    .default(DEFAULT_ROUTE_SEARCH_LIMIT),
});

export const routeStopsQuerySchema = z.object({
  operator: companySchema,
});

export const etaQuerySchema = z.object({
  routeId: z.string().trim().min(1),
  operator: companySchema,
  seq: z.coerce.number().int().min(0),
  lang: languageSchema.default("en"),
});

export type RouteSearchQuery = z.infer<typeof routeSearchQuerySchema>;
export type RouteStopsQuery = z.infer<typeof routeStopsQuerySchema>;
export type EtaQuery = z.infer<typeof etaQuerySchema>;
