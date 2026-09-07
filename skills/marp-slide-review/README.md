# marp-slide-review

Review Marp slide decks for overflow, clipping, visual balance, asset failures,
and HTML/PDF rendering differences.

## Install

```sh
npx skills add codebytes/skills --skill marp-slide-review
```

Reload your agent skills, then invoke `/marp-slide-review`.

## Usage

Install dependencies. The scripts reuse an installed Chrome, Chromium, or Edge
browser. Install Playwright Chromium only when no compatible system browser is
available:

```sh
npm ci --ignore-scripts
npx playwright install chromium
```

Run both structural and rendered review:

```sh
node scripts/check-overflow.mjs --allow-local-files ../../slides/Slides.md
node scripts/render-review.mjs --allow-local-files --pdf ../../slides/Slides.md
```

Open the gallery path printed by `render-review.mjs`, inspect every slide, and
compare representative pages in the generated PDF.

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
