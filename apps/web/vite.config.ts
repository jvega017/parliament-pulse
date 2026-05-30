import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8"),
) as { version: string };

// Resolve commit SHA: CI injects VITE_COMMIT_SHA (e.g. CF_PAGES_COMMIT_SHA);
// fall back to a local git call for dev builds.
function resolveCommitSha(): string {
  if (process.env.VITE_COMMIT_SHA) return process.env.VITE_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    "import.meta.env.VITE_COMMIT_SHA": JSON.stringify(resolveCommitSha()),
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
