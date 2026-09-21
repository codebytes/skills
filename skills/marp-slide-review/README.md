# marp-slide-review

Review Marp slide decks for overflow, clipping, visual balance, asset failures,
and HTML/PDF rendering differences.

## Install

```sh
npx skills add codebytes/skills --skill marp-slide-review
```

Reload your agent skills, then invoke `/marp-slide-review`.

## Usage

Run commands from the installed skill directory with Node.js 22.20+. The
overflow checker uses Playwright and can reuse Chrome, Chromium, or Edge.
Marp CLI has separate browser discovery for PNG/PDF export; set `CHROME_PATH`
to a compatible browser executable if it cannot locate one.

```sh
npm ci --ignore-scripts
```

If no compatible browser is installed, install Playwright Chromium with
`npx playwright install chromium` and point `CHROME_PATH` at its executable
when using Marp's export commands.

Run both structural and rendered review:

```sh
node scripts/check-overflow.mjs --allow-local-files ../../slides/Slides.md
node scripts/render-review.mjs --allow-local-files --pdf ../../slides/Slides.md
```

Add `--html` only for a trusted deck that requires embedded HTML. Both helpers
use the locked Marp CLI, or an explicitly reviewed executable/script path in
`MARP_CMD`; neither silently downloads tools. `--allow-local-files` is also
opt-in and should be omitted when local assets are not needed.

Open the gallery path printed by `render-review.mjs`, inspect every slide, and
compare representative pages in the generated PDF.
A failed conversion preserves an earlier review; only files named by its
validated review manifest may be replaced or removed.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run eval:lint
```

The deterministic test checks the portable skill shape. The Vally capability eval verifies that
the agent follows the workflow.

## License

MIT. See [LICENSE](LICENSE).
