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
node scripts/setup-runtime.mjs
```

If no compatible browser is installed, install Playwright Chromium with
`node scripts/setup-runtime.mjs --install-browser`. Setup prints the executable
to use for `CHROME_PATH` when running Marp's export commands.

Setup runs locked `npm ci --include=dev --ignore-scripts` in an external cache,
never in this skill. The default base is `~/Library/Caches/codebytes-skills` on
macOS, `$XDG_CACHE_HOME/codebytes-skills` (or `~/.cache/codebytes-skills`) on Linux,
and `%LOCALAPPDATA%/codebytes-skills` on Windows. Set `CODEBYTES_SKILLS_CACHE` to
an absolute external directory to override it; use the same value for setup and
rendering. The key includes the manifests, lockfile, OS, architecture, and Node
major version. Updating dependencies or Node selects a fresh cache automatically.
`--print-path` shows the exact runtime directory without installing anything.

Browser downloads use the external cache's `browsers/` directory, or an absolute
external `PLAYWRIGHT_BROWSERS_PATH`. In-skill browser mode (`0`) is rejected.
Never run `npm ci`/`npm install` or link `node_modules` inside an installed skill
or plugin. VS Code can copy these trees when discovering Copilot CLI plugins.
Keep decks and generated review output in your project, not the installed skill.
After stopping renders, old runtime directories printed by `--print-path` may
be removed individually; setup recreates missing dependencies on demand.

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
npm test
```

Deterministic tests need no installed packages. Use the setup command above for
real rendering, including from a source checkout.

Evaluation tooling is not a runtime dependency. With Vally 0.16.0 on `PATH`,
run `npm run eval:lint` or `npm run eval`. Repository contributors install
the shared toolchain under `.github/tools/vally` once and add its
`node_modules/.bin` directory to `PATH`. Tests and evals are included in the
source package, not the lean runtime artifact.

The deterministic test checks the portable skill shape. The Vally capability eval verifies that
the agent follows the workflow.

## License

MIT. See [LICENSE](LICENSE).
