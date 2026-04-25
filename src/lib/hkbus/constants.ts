export const BUS_COMPANIES = [
  "kmb",
  "ctb",
  "nlb",
  "gmb",
  "lrtfeeder",
] as const;

export const SUPPORTED_LANGUAGES = ["en", "zh"] as const;

export const DEFAULT_ROUTE_SEARCH_LIMIT = 20;
export const MAX_ROUTE_SEARCH_LIMIT = 100;

export const ETA_DB_TTL_MS = 1000 * 60 * 30;
export const ETA_DB_MD5_CHECK_INTERVAL_MS = 1000 * 60 * 5;
export const ETA_RESPONSE_TTL_MS = 1000 * 15;
