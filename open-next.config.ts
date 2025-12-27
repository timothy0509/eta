import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // This helper automatically fills in the "wrapper", "converter",
  // and "dummy" fields that the validator was screaming about.
  // You can add custom R2/KV caching here later if you want
  // to cache KMB/MTR route data!
});
