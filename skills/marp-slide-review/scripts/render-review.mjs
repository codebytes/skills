#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const MARP_VERSION = "4.5.0";
const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HELP = `Render a Marp deck to PNGs and an HTML review gallery.

Usage:
  node scripts/render-review.mjs [options] <deck.md>

Options:
  --theme-set <dir>      Theme directory (defaults to slides/themes when present)
  --output <dir>         Output directory (defaults to a temporary directory)
  --allow-local-files    Permit trusted local assets during browser rendering
  --pdf                  Also render a PDF for print-path comparison
  --browser <name>       chrome, edge, firefox, or auto
  --json                 Print machine-readable output
  -h, --help             Show help`;

export function parseArgs(argv) {
  const result = {
    deck: null,
    themeSet: null,
    output: null,
    allowLocalFiles: false,
    pdf: false,
    browser: "auto",
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-h" || value === "--help") result.help = true;
    else if (value === "--theme-set") result.themeSet = argv[++index];
    else if (value === "--output") result.output = argv[++index];
    else if (value === "--allow-local-files") result.allowLocalFiles = true;
    else if (value === "--pdf") result.pdf = true;
    else if (value === "--browser") result.browser = argv[++index];
    else if (value === "--json") result.json = true;
    else if (value.startsWith("-")) throw new Error(`Unknown option: ${value}`);
    else if (result.deck === null) result.deck = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  if (!["auto", "chrome", "edge", "firefox"].includes(result.browser)) {
    throw new Error(`Unsupported browser: ${result.browser}`);
  }
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function marpCommand() {
  const localCli = join(SKILL_ROOT, "node_modules", "@marp-team", "marp-cli", "marp-cli.js");
  if (existsSync(localCli)) return { command: process.execPath, prefix: [localCli] };
  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    prefix: ["--yes", `@marp-team/marp-cli@${MARP_VERSION}`],
  };
}

function runMarp(args) {
  if (process.env.MARP_CMD) {
    throw new Error("render-review requires a single MARP executable path; unset MARP_CMD and install dependencies.");
  }
  const cli = marpCommand();
  const result = spawnSync(cli.command, [...cli.prefix, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Marp CLI failed").trim());
  }
}

function prepareOutput(requested) {
  if (!requested) return mkdtempSync(join(tmpdir(), "marp-review-"));
  const output = resolve(requested);
  if (!existsSync(output)) {
    mkdirSync(output, { recursive: true });
    return output;
  }
  const entries = readdirSync(output);
  const managed = entries.includes("review-manifest.json");
  if (entries.length > 0 && !managed) {
    throw new Error(`Output directory is not empty and is not a prior review: ${output}`);
  }
  for (const entry of entries) {
    if (/^slide\.\d+\.png$/.test(entry) || ["deck.pdf", "index.html", "review-manifest.json"].includes(entry)) {
      rmSync(join(output, entry), { force: true });
    }
  }
  return output;
}

export function buildGallery({ deck, images, pdf, warnings }) {
  const warningHtml = warnings.length
    ? `<section class="warnings"><h2>Warnings</h2><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>`
    : "";
  const pdfLink = pdf
    ? `<a class="button" href="${escapeHtml(pdf)}">Download PDF</a>`
    : "";
  const cards = images.map((image, index) =>
    `<figure><a href="${escapeHtml(image)}"><img src="${escapeHtml(image)}" alt="Rendered slide ${index + 1}"></a>` +
    `<figcaption>Slide ${index + 1}</figcaption></figure>`,
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Marp review - ${escapeHtml(basename(deck))}</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #0d1117; color: #e6edf3; }
    body { max-width: 1500px; margin: 0 auto; padding: 24px; }
    header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    .button { padding: 10px 16px; color: #fff; text-decoration: none; background: #1f6feb; border-radius: 8px; }
    .warnings { padding: 12px 18px; margin: 20px 0; background: #2d2200; border: 1px solid #9e6a03; border-radius: 8px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px; }
    figure { margin: 0; padding: 12px; background: #161b22; border: 1px solid #30363d; border-radius: 10px; }
    img { display: block; width: 100%; height: auto; background: #fff; }
    figcaption { padding-top: 8px; font-weight: 700; }
  </style>
</head>
<body>
  <header><div><h1>Marp review</h1><p>${escapeHtml(deck)}</p></div>${pdfLink}</header>
  ${warningHtml}
  <main class="grid">${cards}</main>
</body>
</html>
`;
}

function detectWarnings(source) {
  const warnings = [];
  if (/```mermaid\b|class=["'][^"']*\bmermaid\b/i.test(source)) {
    warnings.push("runtime Mermaid detected; pre-render it to SVG before relying on PDF output");
  }
  if (/https?:\/\/[^)\s"']+\.(?:woff2?|ttf|otf)(?:[?#][^)\s"']*)?/i.test(source)) {
    warnings.push("remote font detected; compare line wrapping in offline and PDF output");
  }
  return warnings;
}

export function sortSlideImages(images) {
  return [...images].sort((left, right) => {
    const leftPage = Number(left.match(/\d+/)?.[0]);
    const rightPage = Number(right.match(/\d+/)?.[0]);
    return leftPage - rightPage || left.localeCompare(right);
  });
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (!args.deck) {
    console.error(HELP);
    return 2;
  }

  const deck = resolve(args.deck);
  if (!existsSync(deck)) throw new Error(`Deck not found: ${deck}`);
  const output = prepareOutput(args.output);
  const themeSet = args.themeSet ?? (existsSync("slides/themes") ? "slides/themes" : null);
  const common = ["--no-stdin", "--html", "--browser", args.browser];
  if (themeSet) common.push("--theme-set", resolve(themeSet));
  if (args.allowLocalFiles) common.push("--allow-local-files");

  runMarp([...common, "--images", "png", "-o", join(output, "slide.png"), "--", deck]);
  const images = sortSlideImages(
    readdirSync(output).filter((name) => /^slide\.\d+\.png$/.test(name)),
  );
  if (images.length === 0) throw new Error("Marp did not generate any slide images.");

  let pdf = null;
  if (args.pdf) {
    pdf = "deck.pdf";
    runMarp([...common, "--pdf", "--pdf-outlines", "-o", join(output, pdf), "--", deck]);
  }

  const warnings = detectWarnings(readFileSync(deck, "utf8"));
  writeFileSync(join(output, "index.html"), buildGallery({ deck, images, pdf, warnings }));
  const result = {
    deck,
    output,
    gallery: join(output, "index.html"),
    images,
    pdf: pdf ? join(output, pdf) : null,
    warnings,
  };
  writeFileSync(join(output, "review-manifest.json"), `${JSON.stringify(result, null, 2)}\n`);

  if (args.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Gallery: ${result.gallery}`);
    if (result.pdf) console.log(`PDF: ${result.pdf}`);
    for (const warning of warnings) console.log(`Warning: ${warning}`);
  }
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`render-review: ${error.message}`);
    process.exitCode = 2;
  }
}
