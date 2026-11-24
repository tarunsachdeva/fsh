import { spawn, spawnSync } from "node:child_process";
import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PassThrough } from "node:stream";
import readline from "node:readline";
import assert from "node:assert/strict";
import { completePath } from "../bin/completion.mjs";
import { loadFshEnv } from "../bin/env.mjs";

test("Tab completes paths in natural-language input from the current directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fsh-completion-"));
  try {
    await writeFile(join(dir, "file one.txt"), "");
    await writeFile(join(dir, "file-two.txt"), "");
    await writeFile(join(dir, ".secret"), "");
    await mkdir(join(dir, "files"));
    await writeFile(join(dir, "files", "notes.txt"), "");

    assert.deepEqual(completePath("move file", dir), [[
      "move file-two.txt",
      "move file\\ one.txt",
      "move files/",
    ], "move file"]);
    assert.deepEqual(completePath("move files/no", dir), [["move files/notes.txt"], "move files/no"]);
    assert.deepEqual(completePath("move no", join(dir, "files")), [["move notes.txt"], "move no"]);
    assert.deepEqual(completePath("move .se", dir), [["move .secret"], "move .se"]);
    assert.deepEqual(completePath("move missing/fi", dir), [[], "move missing/fi"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readline inserts a completed filename on Tab", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fsh-tab-"));
  const input = new PassThrough();
  const output = new PassThrough();
  input.isTTY = true;
  output.isTTY = true;
  output.columns = 80;
  const rl = readline.createInterface({ input, output, terminal: true, completer: (line) => completePath(line, dir) });
  try {
    await writeFile(join(dir, "file.txt"), "");
    input.write("move file\t");
    assert.equal(rl.line, "move file.txt");
  } finally {
    rl.close();
    input.destroy();
    output.destroy();
    await rm(dir, { recursive: true, force: true });
  }
});

test("checkout environment file supplies a key without overriding an exported key", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fsh-env-"));
  try {
    const file = join(dir, ".env");
    await writeFile(file, 'AI_GATEWAY_API_KEY="from-file"\nFSH_MODEL=anthropic/claude-haiku-5.5\nFSH_SKIP_PERMISSIONS=1\n');
    const values = loadFshEnv(file, { AI_GATEWAY_API_KEY: "from-shell" });
    assert.equal(values.AI_GATEWAY_API_KEY, "from-shell");
    assert.equal(values.FSH_MODEL, "anthropic/claude-haiku-5.5");
    assert.equal(values.FSH_SKIP_PERMISSIONS, "1");
    assert.equal(loadFshEnv(file, {}).AI_GATEWAY_API_KEY, "from-file");
    assert.equal(loadFshEnv(file, { AI_GATEWAY_API_KEY: "" }).AI_GATEWAY_API_KEY, "");
    assert.deepEqual(loadFshEnv(join(dir, "missing.env"), { A: "1" }), { A: "1" });
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

test("rl resets runtime settings without changing the directory", async () => {
  const home = await mkdtemp(join(tmpdir(), "fsh-restart-"));
  try {
    const run = spawnSync(process.execPath, [new URL("../bin/fsh.mjs", import.meta.url).pathname], {
      input: `/show off\n// cd ${home}\nrl\n// pwd\n/quit\n`,
      env: { ...process.env, FSH_SHOW_TRANSLATION: "1", AI_GATEWAY_API_KEY: "" },
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /fsh restarted \(fresh session and settings\)/);
    assert.ok(run.stdout.includes(`Executing: pwd\n${await realpath(home)}\n`), run.stdout);
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
