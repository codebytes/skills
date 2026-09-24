# drawio-diagrams

Create and edit draw.io SVG diagrams that remain visually editable.

## Install

```sh
npx skills add codebytes/skills --skill drawio-diagrams
```

Reload your agent skills, then invoke `/drawio-diagrams`.

## Usage

The dependency-free helper validates JSON and builds accessible, editable
`.drawio.svg` files with rectangles, rounded processes, ellipses, diamonds,
cylinders, straight connectors, and orthogonal connectors:

```sh
node scripts/make-drawio-svg.mjs build assets/example.spec.json \
  -o example.drawio.svg
node scripts/make-drawio-svg.mjs extract example.drawio.svg
node scripts/validate-drawio.mjs example.drawio.svg
```

Run helper commands from the installed skill directory, or use absolute script
and asset paths. Node.js 22.20 or newer is required.

Two richer examples are available in `assets/examples/`:

- Agent skill runtime architecture
- Slide visual routing decision flow

The guidance and validation rules are adapted from the MIT-licensed
`github/awesome-copilot` draw.io diagram generator.

## Development

Run from this skill's directory:

```sh
npm ci --ignore-scripts
npm test
```

Evaluation tooling is not a runtime dependency. With Vally 0.16.0 on `PATH`,
run `npm run eval:lint` or `npm run eval`. Repository contributors install
the shared toolchain under `.github/tools/vally` once and add its
`node_modules/.bin` directory to `PATH`. Tests and evals are included in the
source package, not the lean runtime artifact.

The deterministic test checks the portable skill shape. The Vally capability eval verifies that
the agent follows the workflow.

## License

MIT. See [LICENSE](LICENSE).
