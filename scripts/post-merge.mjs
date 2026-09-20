import { spawnSync } from "node:child_process";

const install = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (install.status !== 0) process.exit(install.status ?? 1);

const push = spawnSync("pnpm", ["--filter", "@workspace/db", "run", "push"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(push.status ?? 1);