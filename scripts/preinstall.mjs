import { unlink } from "node:fs/promises";

const userAgent = process.env.npm_config_user_agent ?? "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead of npm or yarn.");
  process.exit(1);
}

for (const file of ["package-lock.json", "yarn.lock"]) {
  try {
    await unlink(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}