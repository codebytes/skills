#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const SKILL_ROOT = fileURLToPath(new URL("../", import.meta.url));
const HELP = `Install locked rendering dependencies outside the skill/plugin directory.

Usage: node scripts/setup-runtime.mjs [--install-browser | --print-path]

Default: npm ci in a versioned external cache, with lifecycle scripts disabled.
--install-browser also downloads Playwright Chromium (slide-review only).
--print-path prints the dependency cache path without installing anything.
CODEBYTES_SKILLS_CACHE may select an absolute external cache directory.`;

function physicalPath(path) {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  if (parent === path) throw new Error(`Cannot resolve cache path: ${path}`);
  return join(physicalPath(parent), relative(parent, path));
}

function inside(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!isAbsolute(path) && path !== ".." && !path.startsWith("../") && !path.startsWith("..\\"));
}

function externalPath(path, skillRoot) {
  if (!isAbsolute(path)) throw new Error(`Cache path must be absolute: ${path}`);
  const target = physicalPath(resolve(path));
  for (let directory = realpathSync(skillRoot); ; directory = dirname(directory)) {
    const boundary = directory === realpathSync(skillRoot) ||
      [".git", "plugin.json", ".claude-plugin", ".codex-plugin", "gemini-extension.json"]
        .some((marker) => existsSync(join(directory, marker)));
    if (boundary && inside(directory, target)) {
      throw new Error(`Cache must be outside the skill, plugin, and source repository: ${target}`);
    }
    if (dirname(directory) === directory) break;
  }
  return target;
}

export function runtimeInfo(skillRoot = SKILL_ROOT) {
  const source = JSON.parse(readFileSync(join(skillRoot, "package.json"), "utf8"));
  // Source and lean artifacts have different scripts but share the same runtime.
  const manifest = JSON.stringify(Object.fromEntries(
    ["name", "version", "private", "type", "engines", "dependencies", "devDependencies", "optionalDependencies", "overrides"]
      .filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  ), null, 2) + "\n";
  const lock = readFileSync(join(skillRoot, "package-lock.json"), "utf8");
  const key = createHash("sha256").update(manifest).update(lock)
    .update(`${process.platform}-${process.arch}-${process.versions.node.split(".")[0]}`).digest("hex");
  const base = process.env.CODEBYTES_SKILLS_CACHE ?? join(
    process.env.XDG_CACHE_HOME || (process.platform === "darwin" ? join(homedir(), "Library", "Caches")
      : process.platform === "win32" ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
        : join(homedir(), ".cache")), "codebytes-skills",
  );
  const cache = externalPath(base, skillRoot);
  // Check derived paths too: an existing cache child could be a symlink.
  const directory = externalPath(join(cache, "runtimes", key), skillRoot);
  return { cache, directory, manifest, lock, key };
}

export function browserEnvironment(skillRoot = SKILL_ROOT) {
  const { cache } = runtimeInfo(skillRoot);
  const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH ??
    join(cache, "browsers");
  return { ...process.env, PLAYWRIGHT_BROWSERS_PATH: externalPath(browsers, skillRoot) };
}

function ready(info) {
  const marker = join(info.directory, ".ready");
  return existsSync(marker) && readFileSync(marker, "utf8") === info.key &&
    existsSync(join(info.directory, "node_modules"));
}

export function runtimeFile(path, skillRoot = SKILL_ROOT) {
  const info = runtimeInfo(skillRoot);
  const file = join(info.directory, "node_modules", path);
  if (!ready(info) || !existsSync(file)) {
    throw new Error(`Locked runtime missing or incomplete. Run: node "${join(skillRoot, "scripts", "setup-runtime.mjs")}". If already installed, remove the incomplete cache first: ${info.directory}`);
  }
  return file;
}

export function installRuntime(skillRoot = SKILL_ROOT, run = execFileSync) {
  const info = runtimeInfo(skillRoot);
  if (ready(info)) return info.directory;
  if (existsSync(info.directory)) {
    throw new Error(`Incomplete runtime cache; remove this directory and retry setup: ${info.directory}`);
  }
  mkdirSync(dirname(info.directory), { recursive: true });
  const stage = mkdtempSync(join(dirname(info.directory), ".install-"));
  try {
    writeFileSync(join(stage, "package.json"), info.manifest);
    writeFileSync(join(stage, "package-lock.json"), info.lock);
    run(process.platform === "win32" ? "npm.cmd" : "npm",
      ["ci", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
        cwd: stage, stdio: ["ignore", "inherit", "inherit"],
        env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "true", PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1" },
        // npm.cmd requires the command processor; all arguments are fixed literals.
        ...(process.platform === "win32" ? { shell: true } : {}),
      });
    if (!existsSync(join(stage, "node_modules"))) throw new Error("npm ci did not create runtime dependencies");
    writeFileSync(join(stage, ".ready"), info.key);
    try {
      renameSync(stage, info.directory);
    } catch (error) {
      if (!["EEXIST", "ENOTEMPTY"].includes(error.code) || !ready(info)) throw error;
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  return info.directory;
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && !["--help", "--print-path", "--install-browser"].includes(args[0]))) {
      throw new Error(HELP);
    }
    if (args[0] === "--help") console.log(HELP);
    else if (args[0] === "--print-path") console.log(runtimeInfo().directory);
    else {
      if (args[0] === "--install-browser") {
        const pkg = JSON.parse(runtimeInfo().manifest);
        if (!pkg.devDependencies?.playwright) throw new Error("--install-browser requires the slide-review skill");
        // Validate the browser destination before any installation.
        browserEnvironment();
      }
      console.log(`Runtime cache: ${installRuntime()}`);
      if (args[0] === "--install-browser") {
        const env = browserEnvironment();
        execFileSync(process.execPath, [runtimeFile("playwright/cli.js"), "install", "chromium"], {
          stdio: "inherit", env,
        });
        process.env.PLAYWRIGHT_BROWSERS_PATH = env.PLAYWRIGHT_BROWSERS_PATH;
        const { chromium } = createRequire(runtimeFile("playwright/package.json"))("playwright");
        console.log(`For Marp export, set CHROME_PATH to: ${chromium.executablePath()}`);
      }
    }
  } catch (error) {
    console.error(`setup-runtime: ${error.message}`);
    process.exitCode = 2;
  }
}
