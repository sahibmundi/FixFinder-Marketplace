import { loadDotEnv } from "../../scripts/load-env.mjs";

await loadDotEnv();
process.env.NODE_ENV ??= "development";
await import("./build.mjs");
await import("./dist/index.mjs");