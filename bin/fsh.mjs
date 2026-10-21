#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import readline from "node:readline";
import { createFxAgent, memory } from "libfx";

const env = process.env;
let cwd = process.cwd();
let assumeYes = env.FSH_ASSUME_YES === "1";
let autoConfirmSafe = env.FSH_AUTO_CONFIRM_SAFE !== "0";
let showTranslation = env.FSH_SHOW_TRANSLATION !== "0";
let agent;
let session;

const instructions = `You translate natural language into exactly one bash command.
Return only the command, with no markdown, comments, explanations, or extra lines.
Use the supplied working directory as context. Prefer the safest sensible command.
Never output exit, quit, return, or logout.`;

function commandFrom(text) {
  const command = text.trim().replace(/^```(?:bash|sh)?\s*\n?/i, "").replace(/\s*```$/, "").trim();
  if (!command || /[\r\n]/.test(command) || /^(?:\/?exit|\/?quit|return|logout)(?:\s|$)/i.test(command)) {
    throw new Error("Translator did not return a single executable command");
  }
  return command;
}

async function translate(request) {
  agent ??= createFxAgent({
    name: "fsh",
    ...(env.FSH_MODEL ? { model: env.FSH_MODEL } : {}),
    instructions,
    tools: [],
    durability: memory(),
    ...(env.FSH_DEBUG === "1" ? { onEvent: (event) => process.stderr.write(`[fx] ${event.type}\n`) } : {}),
  });
  if (!session || env.FSH_CONTINUOUS_SESSION === "0") session = agent.session();
  const turn = session.prompt(`Working directory: ${cwd}\nRequest: ${request}`);
  let text = "";
  for await (const event of turn) {
    if (event.type === "text_delta") text += event.delta;
  }
  const result = await turn.result;
  if (result.stopReason !== "end_turn") {
    throw new Error(result.error?.message ?? `fx stopped: ${result.stopReason}`);
  }
  return commandFrom(text);
}

// Only simple, read-only commands get a yes default. Other commands default to no.
function safeDefault(command) {
  return autoConfirmSafe && /^(?:pwd|ls|rg|grep|find|cat|head|tail|wc|date|whoami|uname)(?:\s|$)/.test(command)
    && !/[;&|><`$()\n\r]/.test(command);
}

function execute(command) {
  if (showTranslation) process.stdout.write(`Executing: ${command}\n`);
  // A bare cd is handled in the host so it persists across turns.
  const cd = /^cd(?:\s+(~(?:\/[^\s]*)?|\/[^\s]*|\.\.?\/?[^\s]*))?$/.exec(command);
  if (cd) {
    try {
      process.chdir(cd[1]?.replace(/^~/, homedir()) ?? homedir());
      cwd = process.cwd();
    } catch (error) {
      process.stderr.write(`cd: ${error.message}\n`);
    }
    return;
  }
  const result = spawnSync("/bin/bash", ["-c", command], { cwd, stdio: "inherit" });
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  else if (result.status !== 0) process.stderr.write(`Command exited with status ${result.status ?? result.signal}\n`);
}

function help() {
  process.stdout.write(`fsh commands:
  /help                Show this help
  /quit or /exit       Exit
  // <command>         Run a command without translation
  /auto on|off         Toggle yes default for simple read-only commands
  /noconfirm on|off    Toggle confirmation prompts
  /show on|off         Toggle showing the executed command

Other input is translated by libfx. FSH_AUTO_RAW=1 runs it directly.
`);
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const lines = [];
  const waiters = [];
  let closed = false;
  rl.on("line", (line) => {
    if (waiters.length) waiters.shift()(line);
    else lines.push(line);
  });
  rl.on("close", () => {
    closed = true;
    while (waiters.length) waiters.shift()(undefined);
  });
  const nextLine = () => lines.length ? Promise.resolve(lines.shift()) : closed ? Promise.resolve(undefined) : new Promise((resolve) => waiters.push(resolve));

  process.stdout.write("fsh: powered by libfx\nType /help for commands.\n");
  try {
    while (true) {
      if (process.stdin.isTTY) rl.setPrompt(env.FSH_PROMPT ?? "fx> "), rl.prompt();
      const input = await nextLine();
      if (input === undefined || input === "/quit" || input === "/exit" || input === "quit" || input === "exit") break;
      if (!input.trim()) continue;
      if (input === "/help") { help(); continue; }
      if (input === "//") { process.stdout.write("Usage: // <command>\n"); continue; }
      if (input === "/auto on" || input === "/auto off") {
        autoConfirmSafe = input.endsWith("on");
        process.stdout.write(`Auto-confirm safe commands: ${autoConfirmSafe ? "on" : "off"}\n`);
        continue;
      }
      if (input === "/noconfirm on" || input === "/noconfirm off") {
        assumeYes = input.endsWith("on");
        process.stdout.write(`Promptless mode: ${assumeYes ? "on" : "off"}\n`);
        continue;
      }
      if (input === "/show on" || input === "/show off") {
        showTranslation = input.endsWith("on");
        process.stdout.write(`Show translated command: ${showTranslation ? "on" : "off"}\n`);
        continue;
      }
      if (input.startsWith("// ") || env.FSH_AUTO_RAW === "1") {
        execute(input.startsWith("// ") ? input.slice(3) : input);
        continue;
      }

      try {
        const command = await translate(input);
        if (!assumeYes) {
          const yesDefault = safeDefault(command);
          process.stdout.write(`Run: ${command}${yesDefault ? " [Y/n] " : " [y/N] "}`);
          const answer = (await nextLine())?.trim().toLowerCase();
          if (answer === undefined || !(answer === "y" || answer === "yes" || (answer === "" && yesDefault))) {
            process.stdout.write("Skipped\n");
            continue;
          }
        }
        execute(command);
      } catch (error) {
        process.stderr.write(`Translation failed: ${error.message}\n`);
      }
    }
  } finally {
    rl.close();
    await agent?.close();
  }
}

main().catch((error) => {
  process.stderr.write(`fsh: ${error.message}\n`);
  process.exitCode = 1;
});
