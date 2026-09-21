#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HELP = `Render Mermaid source to a static SVG.

Usage:
  node scripts/render-mermaid.mjs <diagram.mmd> [-o diagram.svg]
    [--theme default|neutral|dark|forest] [--background color]
    [--width px] [--height px] [--scale number]

Set MERMAID_CLI_PATH to an mmdc executable when the bundled dependency is not
installed. Set PUPPETEER_EXECUTABLE_PATH or CHROME_PATH for a system browser.`;

export function parseArgs(argv) {
  const result = {
    input: null,
    output: null,
    theme: "neutral",
    background: "transparent",
    width: null,
    height: null,
    scale: 1,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (["-o", "--output", "--theme", "--background", "--width", "--height", "--scale"].includes(value) &&
        (argv[index + 1] === undefined || argv[index + 1].startsWith("--") || argv[index + 1] === "")) {
      throw new Error(`${value} requires a value`);
    }
    if (value === "-h" || value === "--help") result.help = true;
    else if (value === "-o" || value === "--output") result.output = argv[++index];
    else if (value === "--theme") result.theme = argv[++index];
    else if (value === "--background") result.background = argv[++index];
    else if (value === "--width") result.width = Number(argv[++index]);
    else if (value === "--height") result.height = Number(argv[++index]);
    else if (value === "--scale") result.scale = Number(argv[++index]);
    else if (value.startsWith("-")) throw new Error(`Unknown option: ${value}`);
    else if (result.input === null) result.input = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  if (!["default", "neutral", "dark", "forest"].includes(result.theme)) {
    throw new Error(`Unsupported Mermaid theme: ${result.theme}`);
  }
  for (const [name, value] of [["width", result.width], ["height", result.height], ["scale", result.scale]]) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      throw new Error(`${name} must be a positive number.`);
    }
  }
  return result;
}

function commandForCli() {
  const explicit = process.env.MERMAID_CLI_PATH;
  if (explicit) {
    return /\.(?:mjs|cjs|js)$/.test(explicit)
      ? { command: process.execPath, prefix: [resolve(explicit)] }
      : { command: explicit, prefix: [] };
  }

  const skillRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const localCli = resolve(skillRoot, "node_modules", "@mermaid-js", "mermaid-cli", "src", "cli.js");
  if (existsSync(localCli)) return { command: process.execPath, prefix: [localCli] };

  return {
    command: process.platform === "win32" ? "mmdc.cmd" : "mmdc",
    prefix: [],
  };
}

export function renderMermaid(options) {
  const input = resolve(options.input);
  const output = resolve(options.output ?? input.replace(/\.(?:mmd|mermaid)$/i, ".svg"));
  if (!existsSync(input)) throw new Error(`Mermaid source not found: ${input}`);
  if (![".mmd", ".mermaid"].includes(extname(input).toLowerCase())) {
    throw new Error("Mermaid source must use .mmd or .mermaid.");
  }
  if (extname(output).toLowerCase() !== ".svg") {
    throw new Error("Mermaid output must use .svg.");
  }

  const source = readFileSync(input, "utf8").trim();
  if (!source) throw new Error("Mermaid source is empty.");
  if (!/^\s*accTitle\s*:\s*\S/m.test(source) ||
      !/^\s*accDescr\s*(?::\s*\S|\{)/m.test(source)) {
    throw new Error("Mermaid source requires accTitle and accDescr for an accessible SVG.");
  }

  mkdirSync(dirname(output), { recursive: true });
  const work = mkdtempSync(resolve(dirname(output), ".mermaid-render-"));
  const rendered = resolve(work, "diagram.svg");
  const args = [
    "-i", input,
    "-o", rendered,
    "-t", options.theme,
    "-b", options.background,
    "-s", String(options.scale),
  ];
  if (options.width !== null) args.push("-w", String(options.width));
  if (options.height !== null) args.push("-H", String(options.height));

  const cli = commandForCli();
  const browser = process.env.PUPPETEER_EXECUTABLE_PATH ?? process.env.CHROME_PATH;
  try {
    const result = spawnSync(cli.command, [...cli.prefix, ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        ...(browser ? { PUPPETEER_EXECUTABLE_PATH: browser } : {}),
      },
    });
    if (result.error) throw new Error(result.error.message);
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "Mermaid CLI failed").trim());
    }
    const svg = existsSync(rendered) ? readFileSync(rendered, "utf8") : "";
    if (!/<svg\b/i.test(svg) || !/<title\b[^>]*>[^<]+<\/title>/i.test(svg) ||
        !/<desc\b[^>]*>[^<]+<\/desc>/i.test(svg)) {
      throw new Error("Mermaid CLI did not create an SVG with an accessible title and description.");
    }
    renameSync(rendered, output);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return output;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (!args.input) {
    console.error(HELP);
    return 2;
  }
  const output = renderMermaid(args);
  console.log(`Wrote ${output}`);
  return 0;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`render-mermaid: ${error.message}`);
    process.exitCode = 2;
  }
}
