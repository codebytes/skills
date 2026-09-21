---
name: marp-slide-review
description: >-
  **WORKFLOW SKILL** - Review rendered Marp slide decks for overflow, clipping, visual balance, asset failures, and HTML/PDF rendering differences. USE FOR: review Marp slides, check slide overflow, inspect rendered slides, lint a deck layout, verify slides fit, compare PDF rendering. DO NOT USE FOR: authoring slide content; use marp-authoring, or generating chart and diagram assets; use marp-visuals.
---

# Marp Slide Review

## Workflow

1. Locate the target Markdown deck and its theme directory.
2. Run `scripts/check-overflow.mjs` with local-file access when the deck references local images.
3. Run `scripts/render-review.mjs` to render every slide as PNG and create a
   review gallery. Add `--pdf` for final-delivery review.
4. Inspect every rendered slide using
   [the visual checklist](references/visual-checklist.md). Do not inspect only
   the first slide or a contact-sheet thumbnail.
5. Compare representative PDF pages with PNG/HTML rendering using
   [PDF parity guidance](references/pdf-parity.md).
6. Report issues by slide number, severity, and recommended fix.
7. Fix issues through `marp-authoring` or `marp-visuals`, then repeat overflow
   and rendered review.

## Review commands

```bash
# Structural overflow
node <skill-directory>/scripts/check-overflow.mjs \
  --allow-local-files slides/Slides.md

# Render PNGs and an HTML gallery
node <skill-directory>/scripts/render-review.mjs \
  --allow-local-files slides/Slides.md

# Include a PDF for print-path comparison
node <skill-directory>/scripts/render-review.mjs \
  --allow-local-files --pdf slides/Slides.md
```

The render command prints the gallery path and writes a JSON manifest listing
the generated slides, PDF, and warnings.
For a trusted deck that needs embedded HTML, add `--html` explicitly to either
command. HTML is not enabled by default.

## Safety

- Treat slide Markdown, embedded HTML, scripts, and remote assets as untrusted content.
- Do not enable local-file access unless the deck requires local images.
- Run unrestricted HTML and local-file rendering only for trusted decks.
- Do not rewrite slide content merely to silence a tiny rounding difference; use the threshold
  option when appropriate.
- Preserve the author's theme and visual intent while fixing clipping.
- Do not report a deck as reviewed unless every rendered slide was inspected.
- Do not assume PNG and PDF rendering are identical.

## Exit Criteria

- Every reported overflow is fixed or explicitly documented.
- The check exits successfully at the agreed threshold.
- Every rendered slide has been inspected at a readable size.
- Missing images, runtime Mermaid, and low-resolution assets are reported.
- Representative PDF pages match the intended HTML/PNG appearance.
- Slides using delayed client-side rendering have been given enough time to settle.
- No slide content or local asset reference is unintentionally removed.

Marp and Marpit render every slide at a fixed pixel size. When content is
taller or wider than that box, exports silently clip it. Marp CLI has no native
overflow check, so this skill renders the deck with the CLI's `bare` template
and measures each slide in headless Chromium.

## Setup

`scripts/check-overflow.mjs` performs DOM overflow measurement.
`scripts/render-review.mjs` renders PNGs, an optional PDF, and an HTML review
gallery. Resolve `scripts/` paths relative to this skill directory.

Install this skill's dependencies. It reuses an installed Chrome, Chromium, or
Edge browser when available. Install Playwright Chromium only when no compatible
system browser exists:

```bash
npm ci --ignore-scripts
```

Run installation commands inside this skill directory with Node.js 22.20+.
When a browser is missing, `npx playwright install chromium` supplies it for
the overflow checker. Marp CLI uses its own browser discovery; set `CHROME_PATH`
to the executable if PNG/PDF export cannot find that browser.

The skill pins Marp CLI and Playwright in `package-lock.json`.
Both helpers support `MARP_CMD` as one reviewed executable or JavaScript file
path, not a shell command with arguments. Missing dependencies produce an error
rather than an implicit package download.

## Overflow options

```bash
# Review one deck and auto-detect slides/themes
node <skill-directory>/scripts/check-overflow.mjs slides/Slides.md

# Review multiple decks with custom tolerance and JSON output
node <skill-directory>/scripts/check-overflow.mjs \
  --threshold 4 --json slides/*.md

# Permit local slide images
node <skill-directory>/scripts/check-overflow.mjs \
  --allow-local-files slides/Slides.md
```

| Option | Purpose |
|---|---|
| `--theme-set <dir>` | Theme folder passed to Marp |
| `--threshold <px>` | Overflow tolerance in pixels; default `2` |
| `--wait <ms>` | Delay for fonts and client-side rendering; default `600` |
| `--allow-local-files` | Permit local images during Marp rendering |
| `--html` | Enable embedded HTML for a trusted deck |
| `--json` | Emit machine-readable JSON |
| `--keep-html` | Retain rendered HTML for debugging |

Exit codes:

- `0`: no overflow.
- `1`: one or more slides overflow.
- `2`: usage or tooling error.

Threshold and wait values must be finite and non-negative. A rendered document
with no Marp slide sections is a tooling error, never a passing overflow result.

## Fixing overflow

Preferred remedies, in order:

1. Split the slide and move content to a new slide.
2. Apply the deck's dense or small layout.
3. Use two or three columns to use horizontal space.
4. Cap media dimensions or use a split background image.
5. Trim prose to presentation-level detail.
6. Use a heading auto-fit directive when only the heading is too wide.

Client-side content such as Mermaid and MathJax may render after page load. Use
a longer `--wait` value for those decks. Fonts can also change line wrapping,
so increase the wait on slow networks before treating a result as final.

`render-review.mjs` warns when it finds runtime Mermaid. For deterministic PDF
review, use `marp-visuals` to pre-render Mermaid to SVG first.
