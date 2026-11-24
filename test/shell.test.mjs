import { spawn, spawnSync } from "node:child_process";
import { lstat, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFshEnv } from "../bin/env.mjs";

test("checkout environment file supplies a key without overriding an exported key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fsh-env-"));
  try {
    const file = join(dir, ".env");
    await writeFile(file, 'AI_GATEWAY_API_KEY="from-file"\nFSH_MODEL=anthropic/claude-haiku-5.5\n');
    const values = loadFshEnv(file, { AI_GATEWAY_API_KEY: "from-shell" });
    assert.equal(values.AI_GATEWAY_API_KEY, "from-shell");
    assert.equal(values.FSH_MODEL, "anthropic/claude-haiku-5.5");
    assert.equal(loadFshEnv(file, {}).AI_GATEWAY_API_KEY, "from-file");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("raw commands run without credentials and cd persists", async () => {
  const home = await mkdtemp(join(tmpdir(), "fsh-test-"));
  try {
    const child = spawn(process.execPath, [new URL("../bin/fsh.mjs", import.meta.url).pathname], {
      env: { ...process.env, HOME: home, AI_GATEWAY_API_KEY: "", FSH_SHOW_TRANSLATION: "0" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdin.end(`// cd ${home}\n// pwd\n//echo no-space-raw\n/quit\n`);
    const code = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    assert.equal(code, 0, stderr);
    assert.ok(stdout.includes(`${home}\n`), stdout);
    assert.ok(stdout.includes("no-space-raw\n"), stdout);
    assert.equal(stderr, "");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("installer links an executable that resolves libfx", async () => {
  const home = await mkdtemp(join(tmpdir(), "fsh-install-"));
  try {
    const env = { ...process.env, HOME: home, FSH_INSTALL_ALIAS: "0", FSH_INSTALL_GHOSTTY: "0" };
    const root = new URL("..", import.meta.url).pathname;
    const installed = spawnSync("bash", [join(root, "scripts/install.sh")], { env, encoding: "utf8" });
    assert.equal(installed.status, 0, installed.stderr);
    const link = join(home, ".local/bin/fsh");
    assert.equal((await lstat(link)).isSymbolicLink(), true);
    const run = spawnSync(link, { input: "/help\n/quit\n", env, encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /fsh commands:/);
    const removed = spawnSync("bash", [join(root, "scripts/uninstall.sh")], { env, encoding: "utf8" });
    assert.equal(removed.status, 0, removed.stderr);
    await assert.rejects(lstat(link), { code: "ENOENT" });
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
