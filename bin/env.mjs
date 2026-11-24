import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

export function loadFshEnv(path = new URL("../.env", import.meta.url), env = { ...process.env }) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return env; }
  // Exported variables take precedence over the checkout .env file.
  for (const [key, value] of Object.entries(parseEnv(text))) env[key] ??= value;
  return env;
}
