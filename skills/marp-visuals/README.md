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
node <skill-directory>/scripts/chart-to-svg.mjs <chart.json> -o <deck-assets>/chart.svg
```

`assets/example-chart.svg` shows the generated result.

Render Mermaid source to SVG after `node scripts/setup-runtime.mjs`. Setup
runs locked `npm ci --include=dev --ignore-scripts` in an external cache, not
in the skill. Since install scripts are disabled, use an installed Chrome/Chromium executable through
`PUPPETEER_EXECUTABLE_PATH` or `CHROME_PATH`; browser binaries are not downloaded
by the dependency installation.

```sh
node scripts/render-mermaid.mjs diagram.mmd -o diagram.svg
```

The default cache base is `~/Library/Caches/codebytes-skills` on macOS,
`$XDG_CACHE_HOME/codebytes-skills` (or `~/.cache/codebytes-skills`) on Linux, and
`%LOCALAPPDATA%/codebytes-skills` on Windows. Set `CODEBYTES_SKILLS_CACHE` to an
absolute external directory to override it, using the same value for setup and
rendering. Manifests, lockfile, OS, architecture, and Node major version form the
cache key. `node scripts/setup-runtime.mjs --print-path` shows the exact directory.
After stopping renders, old runtime directories may be removed individually.

Never run `npm ci`/`npm install` or link `node_modules` inside an installed skill
or plugin. IDEs can copy the entire installed plugin tree. Keep source diagrams
and generated outputs in your deck project and use absolute script paths there.
Rendering never implicitly installs tools or falls back to an unpinned `mmdc`
on `PATH`; set `MERMAID_CLI_PATH` explicitly to use a reviewed alternative.

`assets/example-flow.mmd` and `assets/example-flow.svg` show the source and
rendered result. Include Mermaid `accTitle` and `accDescr` metadata in new
sources. A failed or inaccessible render does not replace an existing output.

Keep the JSON or Mermaid source beside the generated SVG.

## Development

Run from this skill's directory:

```sh
npm test
```

Deterministic tests need no installed packages. Use the external setup command
above for real Mermaid rendering, including from a source checkout.

Evaluation tooling is not a runtime dependency. With Vally 0.16.0 on `PATH`,
run `npm run eval:lint` or `npm run eval`. Repository contributors install
the shared toolchain under `.github/tools/vally` once and add its
`node_modules/.bin` directory to `PATH`. Tests and evals are included in the
source package, not the lean runtime artifact.

The deterministic test checks the portable skill shape. The Vally capability eval verifies that
the agent follows the workflow.

## License

MIT. See [LICENSE](LICENSE).
