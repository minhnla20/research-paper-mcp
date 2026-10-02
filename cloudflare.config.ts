import { bindings, defineConfig } from "cf/config";
import * as entrypoint from "./src/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "research-paper-mcp",
    compatibilityDate: "2026-09-30",
    domains: ["research-paper-mcp.minhresearch.org"],
    workersDev: true,
    previewUrls: true,
    entrypoint,
  },
});
