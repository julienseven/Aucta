import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/* Minimal .env loader (Next.js loads .env for the app; Vitest does not). */
const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
  const raw = readFileSync(envFile, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
