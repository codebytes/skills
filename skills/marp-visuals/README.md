# marp-visuals

Create deterministic charts, Mermaid diagrams, graphs, and accessible static visual assets for Marp decks.

## Install

```sh
npx skills add codebytes/skills --skill marp-visuals
```

Reload your agent skills, then invoke `/marp-visuals`.

## Usage

Run commands from the installed skill directory with Node.js 22.20+, or use
absolute script/input paths. The chart helper needs no npm dependencies.

Generate a static SVG chart from JSON:

```sh
node scripts/chart-to-svg.mjs assets/example-chart.json -o example-chart.svg
```

`assets/example-chart.svg` shows the generated result.

Render Mermaid source to SVG after `npm ci --ignore-scripts`. Since install
scripts are disabled, use an installed Chrome/Chromium executable through
`PUPPETEER_EXECUTABLE_PATH` or `CHROME_PATH`; browser binaries are not downloaded
by the dependency installation.

```sh
node scripts/render-mermaid.mjs diagram.mmd -o diagram.svg
```

`assets/example-flow.mmd` and `assets/example-flow.svg` show the source and
rendered result. Include Mermaid `accTitle` and `accDescr` metadata in new
sources. A failed or inaccessible render does not replace an existing output.

Keep the JSON or Mermaid source beside the generated SVG.

## Development

Run from this skill's directory:

```sh
npm ci --ignore-scripts
npm test
npm run eval:lint
```

The deterministic test checks the portable skill shape. The Vally capability eval verifies that
the agent follows the workflow.

## License

MIT. See [LICENSE](LICENSE).
