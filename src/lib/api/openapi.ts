const schema = {
  openapi: "3.1.0",
  info: {
    title: "HK Bus ETA API",
    version: "0.1.0",
    description:
      "API-only backend for Hong Kong bus ETA built with Next.js Route Handlers and hk-bus-eta.",
  },
  servers: [{ url: "http://localhost:3000" }],
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
      },
    },
    "/api/operators": {
      get: {
        summary: "Supported bus operators",
      },
    },
    "/api/routes": {
      get: {
        summary: "Search routes",
        parameters: [
          {
            in: "query",
            name: "query",
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "operator",
            schema: { type: "string", enum: ["kmb", "ctb", "nlb", "gmb", "lrtfeeder"] },
          },
          {
            in: "query",
            name: "limit",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
      },
    },
    "/api/routes/{routeId}/stops": {
      get: {
        summary: "List stops for a route and operator",
        parameters: [
          {
            in: "path",
            name: "routeId",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "operator",
            required: true,
            schema: { type: "string", enum: ["kmb", "ctb", "nlb", "gmb", "lrtfeeder"] },
          },
        ],
      },
    },
    "/api/eta": {
      get: {
        summary: "Fetch ETA for a route stop",
        parameters: [
          {
            in: "query",
            name: "routeId",
            required: true,
            schema: { type: "string" },
          },
          {
            in: "query",
            name: "operator",
            required: true,
            schema: { type: "string", enum: ["kmb", "ctb", "nlb", "gmb", "lrtfeeder"] },
          },
          {
            in: "query",
            name: "seq",
            required: true,
            schema: { type: "integer", minimum: 0 },
          },
          {
            in: "query",
            name: "lang",
            schema: { type: "string", enum: ["en", "zh"], default: "en" },
          },
        ],
      },
    },
  },
} as const;

export function getOpenApiSchema() {
  return schema;
}
