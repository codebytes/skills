# marp-visuals

Create deterministic charts, Mermaid diagrams, graphs, and accessible static visual assets for Marp decks.

## Install

```sh
npx skills add codebytes/skills --skill marp-visuals
```

Reload your agent skills, then invoke `/marp-visuals`.

## Usage

Generate a static SVG chart from JSON:

```sh
node scripts/chart-to-svg.mjs assets/example-chart.json -o example-chart.svg
```

`assets/example-chart.svg` shows the generated result.

Render Mermaid source to SVG after installing the skill dependencies:

```sh
node scripts/render-mermaid.mjs diagram.mmd -o diagram.svg
```

`assets/example-flow.mmd` and `assets/example-flow.svg` show the source and
rendered result.

Keep the JSON or Mermaid source beside the generated SVG.

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
