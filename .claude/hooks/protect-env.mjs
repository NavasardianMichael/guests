// PreToolUse hook: Claude may not read or write env files (.env, .env.local, server/.env.production.local, …).
// Only the documented templates (*.env.example) stay open.
//
// - Read / Write / Edit / MultiEdit / NotebookEdit on an env file -> denied.
// - Grep on an env file -> denied; any other Grep gets `!**/.env*` added to its glob, because
//   Grep also searches hidden and gitignored files and would otherwise print env lines.
// - Bash / PowerShell commands that name an env file (`cat .env`, `cp x server/.env`) -> denied.

import { readFileSync } from "node:fs";

const EXCLUDE_ENV_GLOB = "!**/.env*";

const basename = (p) => String(p).split(/[\\/]/).pop() ?? "";

const isExample = (base) => base.toLowerCase().endsWith(".env.example");

// A path handed to a file tool: `.env*`, `name.env`, `name.env.*`.
const isEnvFile = (path) => {
  const base = basename(path).toLowerCase();
  if (!base || isExample(base)) return false;
  return base.startsWith(".env") || /\.env(\.|$)/.test(base);
};

// A word in a shell command. Stricter about `name.env` so `process.env.X` is not caught.
const isEnvWord = (word) => {
  const base = basename(word).toLowerCase();
  if (!base || isExample(base)) return false;
  if (base.startsWith(".env")) return true;
  return /[\\/]/.test(word) && /\.env(\.|$)/.test(base);
};

const shellWords = (command) =>
  String(command)
    .split(/[\s"'`;|&<>(){}=,]+/)
    .filter(Boolean);

const deny = (reason) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
};

const REASON =
  "Env files are off limits (they hold secrets): only *.env.example may be read or written. " +
  "Ask the user to make the change themselves, or document the variable in the .env.example.";

const input = JSON.parse(readFileSync(0, "utf8"));
const tool = input.tool_name;
const args = input.tool_input ?? {};

switch (tool) {
  case "Read":
  case "Write":
  case "Edit":
  case "MultiEdit":
  case "NotebookEdit": {
    const target = args.file_path ?? args.notebook_path;
    if (target && isEnvFile(target)) deny(`${REASON} (${basename(target)})`);
    break;
  }
  case "Grep": {
    if (args.path && isEnvFile(args.path)) deny(`${REASON} (${basename(args.path)})`);
    const glob = args.glob ? `${args.glob} ${EXCLUDE_ENV_GLOB}` : EXCLUDE_ENV_GLOB;
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          updatedInput: { ...args, glob },
        },
      }),
    );
    break;
  }
  case "Bash":
  case "PowerShell": {
    const hit = shellWords(args.command ?? "").find(isEnvWord);
    if (hit) deny(`${REASON} (the command names ${basename(hit)})`);
    break;
  }
}

process.exit(0);
