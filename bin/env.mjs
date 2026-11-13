import { config } from "dotenv";

export function loadFshEnv(path = new URL("../.env", import.meta.url), env = process.env) {
  // dotenv leaves variables already present in the process environment alone.
  config({ path, processEnv: env, quiet: true });
  return env;
}
