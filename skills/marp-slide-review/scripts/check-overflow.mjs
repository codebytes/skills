#!/usr/bin/env node
/**
 * check-overflow.mjs — detect content overflow in Marp slide decks.
 *
 * Marp CLI has no built-in overflow check, so this script:
 *   1. Renders the deck to a standalone HTML file with Marp CLI's `bare`
 *      template (every slide becomes a laid-out <section id="N"> at the deck's
 *      native pixel size, e.g. 1280x720).
 *   2. Loads that HTML in headless Chromium (Playwright) and, for each slide,
 *      compares scrollHeight/scrollWidth against clientHeight/clientWidth.
 *   3. Reports any slide whose content spills past the slide boundary and exits
 *      non-zero so it can gate CI.
 *
 * Usage:
 *   node <skill-directory>/scripts/check-overflow.mjs [options] <deck.md> [moreDeck.md ...]
 *
 * Options:
 *   --theme-set <dir>   Theme folder passed to Marp (default: slides/themes if it exists)
 *   --threshold <px>    Overflow tolerance in pixels (default: 2)
 *   --wait <ms>         Settle delay after load for fonts/CDN CSS (default: 600)
 *   --allow-local-files Pass --allow-local-files to Marp (needed for local images)
 *   --json              Emit machine-readable JSON instead of a table
 *   --keep-html         Do not delete the rendered HTML (prints its path)
 *   -h, --help          Show help
 *
 * Requirements:
 *   npm ci --ignore-scripts && npx playwright install chromium
 *   Marp CLI is pinned in this skill package. Override with MARP_CMD only when
 *   intentionally using another reviewed installation.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `Detect content overflow in Marp slides.

Usage: node check-overflow.mjs [options] <deck.md> [moreDeck.md ...]

Options:
  --theme-set <dir>   Theme folder passed to Marp (default: slides/themes)
  --threshold <px>    Overflow tolerance in pixels (default: 2)
  --wait <ms>         Settle delay for fonts/CDN CSS (default: 600)
  --allow-local-files Pass --allow-local-files to Marp (local images)
  --html             Enable embedded HTML only for a trusted deck
  --json              Emit JSON instead of a table
  --keep-html         Keep the rendered HTML and print its path
  -h, --help          Show this help

Exit code: 0 = no overflow, 1 = overflow found, 2 = usage/tooling error.`;

export function parseArgs(argv) {
  const opts = {
    themeSet: null,
    threshold: 2,
    wait: 600,
    allowLocalFiles: false,
    html: false,
    json: false,
    keepHtml: false,
    decks: [],
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (['--theme-set', '--threshold', '--wait'].includes(a) &&
        (argv[i + 1] === undefined || argv[i + 1].startsWith('--') || !argv[i + 1].trim())) {
      throw new Error(`${a} requires a value`);
    }
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '--theme-set') opts.themeSet = argv[++i];
    else if (a === '--threshold') opts.threshold = Number(argv[++i]);
    else if (a === '--wait') opts.wait = Number(argv[++i]);
    else if (a === '--allow-local-files') opts.allowLocalFiles = true;
    else if (a === '--html') opts.html = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--keep-html') opts.keepHtml = true;
    else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    else opts.decks.push(a);
  }
  for (const key of ['threshold', 'wait']) {
    if (!Number.isFinite(opts[key]) || opts[key] < 0) {
      throw new Error(`--${key} must be a finite non-negative number`);
    }
  }
  return opts;
}

async function loadChromium() {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new Error('Playwright is not installed. Run npm ci --ignore-scripts in the skill directory.', { cause: error });
  }
  const candidates = [
      process.env.CHROME_PATH,
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
  ].filter(Boolean);
  return {
    chromium,
    executablePath: candidates.find((candidate) => existsSync(candidate)) ?? null,
  };
}

function renderDeck(deck, tmpDir, opts) {
  const outHtml = join(tmpDir, 'deck.html');
  const args = [
    '--no-stdin', '--template', 'bare',
    opts.html ? '--html' : '--no-html',
    '--base-url', pathToFileURL(`${dirname(resolve(deck))}${sep}`).href,
  ];
  if (opts.themeSet) args.push('--theme-set', opts.themeSet);
  if (opts.allowLocalFiles) args.push('--allow-local-files');
  args.push('-o', outHtml, '--', deck);
  try {
    runMarp(args);
  } catch (err) {
    const detail = (err.stderr || '').toString().trim();
    throw new Error(`Marp render failed for ${deck}: ${detail || err.message}`, { cause: err });
  }
  return outHtml;
}

function runMarp(args) {
  if (process.env.MARP_CMD) {
    const command = process.env.MARP_CMD;
    const isScript = /\.(?:mjs|cjs|js)$/.test(command);
    execFileSync(isScript ? process.execPath : command, isScript ? [command, ...args] : args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return;
  }
  const localCli = join(SKILL_ROOT, 'node_modules', '@marp-team', 'marp-cli', 'marp-cli.js');
  if (existsSync(localCli)) {
    execFileSync(process.execPath, [localCli, ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    return;
  }
  throw new Error('Marp CLI is not installed. Run npm ci --ignore-scripts in the skill directory.');
}

export function measureDocument(threshold, doc = document) {
  const slides = [...doc.querySelectorAll('section[id]')].filter((el) => /^\d+$/.test(el.id));
  if (slides.length === 0) throw new Error('No Marp slides found in rendered HTML.');
  const rows = [];
  for (const el of slides) {
    const overY = el.scrollHeight - el.clientHeight;
    const overX = el.scrollWidth - el.clientWidth;
    if (overY <= threshold && overX <= threshold) continue;
    const heading = el.querySelector('h1, h2, h3, h4');
    rows.push({
      slide: Number(el.id),
      title: (heading ? heading.textContent : '').trim().slice(0, 48),
      overflowY: Math.max(0, Math.round(overY)),
      overflowX: Math.max(0, Math.round(overX)),
    });
  }
  return rows.sort((a, b) => a.slide - b.slide);
}

async function measure(runtime, htmlPath, opts) {
  const browser = await runtime.chromium.launch(
    runtime.executablePath ? { executablePath: runtime.executablePath } : {},
  );
  try {
    const page = await browser.newPage();
    if (!opts.allowLocalFiles) {
      await page.route('file://**/*', (route) =>
        route.request().url() === pathToFileURL(htmlPath).href ? route.continue() : route.abort());
    }
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    // Let webfonts (Font Awesome) and any CDN CSS settle so widths are real.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(opts.wait);
    return await page.evaluate(measureDocument, opts.threshold);
  } finally {
    await browser.close();
  }
}

async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) { console.log(HELP); return 0; }
  if (opts.decks.length === 0) { console.error(HELP); return 2; }
  if (opts.themeSet == null && existsSync('slides/themes')) opts.themeSet = 'slides/themes';

  const chromium = await loadChromium();
  const results = [];
  let hadOverflow = false;

  for (const deck of opts.decks) {
    if (!existsSync(deck)) throw new Error(`Deck not found: ${deck}`);
    const tmpDir = mkdtempSync(join(tmpdir(), 'marp-overflow-'));
    try {
      const html = renderDeck(deck, tmpDir, opts);
      const overflows = await measure(chromium, html, opts);
      results.push({ deck, overflows });
      if (overflows.length) hadOverflow = true;
      if (opts.keepHtml) console.error(`Rendered HTML kept: ${html}`);
    } finally {
      if (!opts.keepHtml) rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: !hadOverflow, results }, null, 2));
  } else {
    for (const { deck, overflows } of results) {
      if (!overflows.length) {
        console.log(`✅ ${deck}: no overflow detected`);
        continue;
      }
      console.log(`⚠️  ${deck}: ${overflows.length} slide(s) overflow`);
      for (const o of overflows) {
        const dir = [];
        if (o.overflowY) dir.push(`${o.overflowY}px tall`);
        if (o.overflowX) dir.push(`${o.overflowX}px wide`);
        console.log(`   • Slide ${o.slide}${o.title ? ` — "${o.title}"` : ''}: over by ${dir.join(', ')}`);
      }
    }
  }
  return hadOverflow ? 1 : 0;
}

if (import.meta.main) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(`check-overflow: ${error.message}`);
    process.exitCode = 2;
  }
}
