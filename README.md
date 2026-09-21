# Codebytes Skills

Portable, tested agent skills for GitHub Copilot, Codex, Claude Code, Cursor, Gemini CLI, and other Agent Skills compatible hosts\.

## Skills

| Skill | What it does |
|---|---|
| [`create-skill`](skills/create-skill/) | \*\*WORKFLOW SKILL\*\* - Create and register a complete portable agent skill in a managed skills-repo\.config\.json repository or an existing skills repository\. Produces focused instructions, documentation, deterministic tests, Vally evals, locked tooling, registration, and optional validated thumbnail art\. USE FOR: create-skill, create a skill, add an agent skill, scaffold a portable skill, register a skill, add skill to managed repo, create skill in existing repo, generate an example skill from a fixture, add skill thumbnail art\. DO NOT USE FOR: scaffolding a new marketplace collection from scratch \(use create-skills-repo\), editing one existing skill instruction without registration work \(use skill-authoring\), creating an agent persona\. |
| [`csv-analysis`](skills/csv-analysis/) | \*\*WORKFLOW SKILL\*\* - Analyze CSV files and generate statistical data quality reports\. USE FOR: analyze CSV files, profile tabular data, inspect CSV quality, generate CSV reports\. DO NOT USE FOR: editing spreadsheets or producing XLSX workbooks; use spreadsheet tooling instead\. |
| [`drawio-diagrams`](skills/drawio-diagrams/) | \*\*WORKFLOW SKILL\*\* - Create, validate, and edit accessible draw\.io SVG diagrams that remain visually editable\. Supports basic flowchart and architecture shapes, semantic styling, orthogonal connectors, strict specification validation, and embedded mxGraph XML\. USE FOR: create a draw\.io diagram, create a \.drawio\.svg, make an editable architecture or flow diagram, validate draw\.io XML, use diagrams\.net\. DO NOT USE FOR: quick throwaway diagrams that do not need draw\.io editability; use Mermaid instead, or complex cloud/UML diagrams that require full draw\.io shape libraries; use draw\.io Desktop or jgraph/drawio-mcp\. |
| [`marp-authoring`](skills/marp-authoring/) | \*\*WORKFLOW SKILL\*\* - Create and revise Marp decks with reliable slide structure, content transformations, speaker notes, layouts, and existing theme styles\. USE FOR: create Marp slides, add a slide, rewrite slide content, split or merge slides, reorder a deck, add speaker notes, apply slide layouts, restyle slides\. DO NOT USE FOR: generating chart or diagram assets; use marp-visuals, or reviewing overflow and rendering; use marp-slide-review\. |
| [`marp-slide-review`](skills/marp-slide-review/) | \*\*WORKFLOW SKILL\*\* - Review rendered Marp slide decks for overflow, clipping, visual balance, asset failures, and HTML/PDF rendering differences\. USE FOR: review Marp slides, check slide overflow, inspect rendered slides, lint a deck layout, verify slides fit, compare PDF rendering\. DO NOT USE FOR: authoring slide content; use marp-authoring, or generating chart and diagram assets; use marp-visuals\. |
| [`marp-visuals`](skills/marp-visuals/) | \*\*WORKFLOW SKILL\*\* - Create deterministic charts, Mermaid diagrams, graphs, and accessible static visual assets for Marp decks\. USE FOR: add a chart to slides, build a graph, create a Mermaid diagram, turn data into a slide visual, generate SVG assets for Marp\. DO NOT USE FOR: editing slide narrative or layout; use marp-authoring, or creating diagrams that must remain editable in draw\.io; use drawio-diagrams\. |
| [`pptx-to-marp-theme`](skills/pptx-to-marp-theme/) | \*\*WORKFLOW SKILL\*\* - Extract brand colors, font families, logos, images, and slide dimensions from PowerPoint templates, generate a Marp CSS theme, and safely apply it to existing decks\. USE FOR: convert a PowerPoint template to a Marp theme, extract PPTX or POTX branding, extract colors fonts logos and images, apply a PowerPoint-derived theme to existing Marp slides\. DO NOT USE FOR: editing PowerPoint slide content; use PPTX tooling, or rewriting Marp slide narrative; use marp-authoring\. |

## Install

Install the collection with **one method per client** to avoid duplicate skills.
Review the skill instructions and scripts before enabling them. Installation does
not grant permission to run every bundled script.

### Standalone skills

The community [Skills CLI](https://skills.sh/docs/cli) can list the collection or
install selected skills into an agent's supported skill directory:

```sh
npx skills add https://github.com/codebytes/skills --list
npx skills add https://github.com/codebytes/skills --skill csv-analysis
```

Use `--skill '*'` for the complete collection while retaining the agent-selection
prompt. The current installer's `--all` installs every skill to every agent without
prompts; do not use it for a single-client setup. Keep each skill's supporting
files with its `SKILL.md`; do not copy only the Markdown file.

### GitHub Copilot CLI

```sh
copilot plugin marketplace add codebytes/skills
copilot plugin install codebytes-skills@codebytes-skills
```

For an individual skill, install `csv-analysis@codebytes-skills` instead.
Individual marketplace entries use Copilot/VS Code's skill-only compatibility
format; the complete collection is the portable Agent Plugins 1.0 package.

### Claude Code CLI

```sh
claude plugin marketplace add codebytes/skills
claude plugin install codebytes-skills@codebytes-skills
```

The equivalent interactive commands start with `/plugin`. Claude uses
`.claude-plugin/marketplace.json`, which advertises the complete collection.

### Codex CLI

Use **Codex CLI 0.142.0 or newer** for this repository-root marketplace.

```sh
codex --version
codex plugin marketplace add codebytes/skills
codex plugin list --available --json
codex plugin add codebytes-skills@codebytes-skills
```

Confirm the collection appears in the available list, then start a new session
after installing. Codex 0.138.0 can register this marketplace but silently omit
its `source: "local", path: "./"` plugin and report "plugin not found".
[Codex 0.142.0 fixed root-local marketplace installation](https://github.com/openai/codex/releases/tag/rust-v0.142.0);
upgrade the client rather than changing the repository's valid local source.

For local development, pass the checkout directory to `codex plugin marketplace
add` instead of the GitHub repository name. This preserves local-checkout
behavior without duplicating the canonical skill tree or forcing installs from
published `main`.

### Gemini CLI

```sh
gemini extensions install https://github.com/codebytes/skills
gemini skills list --all
```

Gemini discovers `skills/` automatically from the extension. No `skills` field,
MCP server, or `GEMINI.md` is required in this skills-only extension.

### VS Code

Use the Extensions view's `@agentPlugins` filter. Add `codebytes/skills` to the
**user-level** `chat.plugins.marketplaces` setting, preserving existing entries,
then install the collection. This is an agent-plugin marketplace, not a VSIX
extension in Visual Studio Marketplace.

VS Code also discovers plugins already installed by Copilot CLI. Do not install
a duplicate when that collection is already enabled. For local development,
`chat.pluginLocations` maps the absolute checkout path to `true`; use this as an
alternative to a copied installation. Do not use the older `chat.plugins.paths`
or deprecated `chat.agentSkillsLocations` settings in a new setup.

### JetBrains Rider

With JetBrains AI Assistant enabled, open **Settings | Tools | AI Assistant |
Skills**. Use **Skills Settings | Manage Skill Directories** to add this checkout's
`skills/` directory, or **Manage External Registries** to add `https://github.com/codebytes/skills`.
Select a skill, choose the intended IDE/project/agent scope, install it, and use
**Try in chat** to confirm availability.

IDE-installed skills are not automatically installed for terminal clients.
Claude Agent's project skills use `.claude/skills/`; shared project skills use
`.agents/skills/`. Junie supports portable skills through its own discovery
locations, including `.junie/skills/`, and should not be assumed to share every
IDE-wide installation. No IntelliJ plugin manifest or Rider-specific copy of
the canonical skills is needed in this repository.

## Supported agents

Canonical content lives in `skills/`. Root `plugin.json` follows the published
**Agent Plugins 1.0.0** schema. Native Claude, Codex, Cursor, and Gemini discovery
manifests are retained for their respective clients.

Cursor loads the root standard `plugin.json`; its marketplace points to that
package. A second `.cursor-plugin/plugin.json` is unnecessary for this
skills-only collection.

OpenAI's plugin format also supports ChatGPT on supported surfaces, but adding a
repository marketplace does **not** publish it to the universal public directory.
Workspace policy and the selected surface control availability. The Codex IDE
extension currently does not support plugin installation; use standalone skills
there. Format compatibility does not guarantee that every host can execute every
skill's Node.js, Python, browser, or document-processing dependencies.

## Updating installed skills and plugins

Update through the **same mechanism used to install** the collection. Updating a
marketplace refreshes its catalog; it is not always an update of installed copies.
Review changes before applying updates, then start a new agent session.

| Installation | Update procedure |
| --- | --- |
| Skills CLI | Run `npx skills update` and select the intended scope, or `npx skills update csv-analysis` to target one installer-managed skill. |
| Copilot CLI marketplace | Run `copilot plugin marketplace update codebytes-skills`, then `copilot plugin update codebytes-skills@codebytes-skills`. Substitute the individual skill name if installed separately. |
| Copilot CLI direct Git URL | Run `copilot plugin update codebytes-skills`; no marketplace suffix is needed for a direct install. |
| Claude Code | Run `claude plugin marketplace update codebytes-skills`, then `claude plugin update codebytes-skills@codebytes-skills`. |
| Codex CLI | Run `codex plugin marketplace upgrade codebytes-skills` to refresh the catalog. On clients with `plugin add/remove` but no `plugin update`, remove and re-add the qualified plugin as shown below. |
| Gemini extension | Run `gemini extensions update codebytes-skills`, then restart Gemini. `/skills reload` refreshes skill discovery; it does not download extension updates. |
| VS Code | Update from the original source. Use Copilot CLI for a CLI-managed install; use the Agent Plugins UI's available update actions for a VS Code-managed install. |
| Rider | Refresh the configured source in Skills settings and replace/update the installed copy at its original scope. A local source directory and an IDE-installed copy are different things. Verify with **Try in chat**. |
| ChatGPT | Use the Plugins UI and the workspace's marketplace-sync process where available; local CLI updates do not guarantee a workspace-managed plugin update. |

For Codex CLI versions with `plugin add/remove` but no `plugin update`:

```sh
codex plugin marketplace upgrade codebytes-skills
codex plugin remove codebytes-skills@codebytes-skills
codex plugin add codebytes-skills@codebytes-skills
```

For a linked/local development installation, update the source checkout first
(preserving local edits), then reload or restart the client. For manually copied
skills, refresh the **whole skill directory**, not just `SKILL.md`.

These commands update the collection, not the client application. Upgrade an old
CLI/IDE through its own documented installer if it lacks the required commands.
Maintainers must version changed plugin releases; an unchanged plugin version can
leave a copied installation cached, particularly in Claude Code.

## Compatibility references

Guidance reviewed **2026-09-20**. The portable 1.0 standard was published on
August 6; the 1.1 specification is still a working draft, not a migration target.

- [Agent Plugins 1.0 specification](https://agent-plugins.org/specification) and
  [Agent Skills specification](https://agentskills.io/specification).
- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference)
  and [marketplaces](https://code.claude.com/docs/en/plugin-marketplaces).
- [OpenAI plugin packaging and marketplaces](https://developers.openai.com/plugins/build/plugins)
  and [supported ChatGPT/Codex surfaces](https://learn.chatgpt.com/docs/plugins).
- [Gemini CLI extensions](https://geminicli.com/docs/extensions/reference/)
  and [skills](https://geminicli.com/docs/cli/skills/).
- [Copilot Agent Plugins GA announcement, August 12](https://github.blog/changelog/2026-08-12-agent-plugins-1-0-in-vs-code-copilot-cli-and-the-copilot-app/)
  and [CLI plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).
- [VS Code agent plugins](https://code.visualstudio.com/docs/agent-customization/agent-plugins)
  and [VS Code 1.138 release](https://code.visualstudio.com/updates/v1_138).
- [Cursor plugin formats](https://cursor.com/docs/reference/plugins).
- [Rider skills](https://www.jetbrains.com/help/rider/AI_skills_hooks.html),
  [AI Assistant Skills Manager](https://www.jetbrains.com/help/ai-assistant/agent-skills.html),
  and [Junie skills](https://junie.jetbrains.com/docs/agent-skills.html).

### Maintaining these generated views

Edit `skills-repo.config.json` for repository identity and
`.skills-repo/templates/install.md` for installation, updates, and validation guidance.
From the repository root:

```sh
node .skills-repo/sync.mjs --dry-run
node .skills-repo/sync.mjs --approve <hash-from-preview>
node .skills-repo/sync.mjs --check
```

This narrowly scoped sync updates the native Codex marketplace, this README's
installation/update/validation sections, and their managed hashes. It preserves the generated
skill table and other manifests, rejects unexpected managed-file edits, and uses
the bundled atomic writer. It does not install clients, access the network, or
replace the full `create-skills-repo sync` lifecycle used after adding/removing
skills or changing repository identity. Run this local sync after that lifecycle
too, so the documentation and compatibility views remain current. The native
Codex marketplace intentionally retains its local-root source and requires a
client with the upstream root-local fix.

## Validation

Use Node.js **22.20+** for the skill helpers and Python **3.10+** for
`pptx-to-marp-theme`. The catalog requires Node.js **24+** and npm **11.10+**.
Run the following from the repository root. Package installs use your configured
npm feed; do not bypass organizational feed policy when a package is unavailable.

```sh
npm ci --prefix .github/tools/vally --ignore-scripts
npm test --prefix .github/tools/vally
node .skills-repo/sync.mjs --check
```

The root `npm test` command above runs repository tests, not the Vally
implementation's own tests. Lint and run each skill's deterministic tests with:

```sh
vally="$PWD/.github/tools/vally/node_modules/.bin/vally"
for skill in skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  id=${skill#skills/}
  "$vally" lint "$skill" --strict
  "$vally" lint --eval-spec "$skill/evals/$id/eval.yaml" --strict
  npm ci --prefix "$skill" --ignore-scripts
  npm test --prefix "$skill"
done
```

## Skill quality

| Check | What it establishes |
| --- | --- |
| Repository tests | Manifest contracts, marketplace paths, complete skill/eval/catalog coverage, local documentation links, and portable CLI entry points |
| Skill-local tests | Deterministic behavior of scripts, fixtures, and validation failures |
| Vally lint | Static skill and capability-eval specification checks |
| Waza mock trigger suites | Deterministic trigger-grader checks and declared requirement coverage, not measured live-agent routing accuracy |
| Vally agent evaluations | Workflow reasoning, skill invocation, and safety behavior; these are not a complete end-to-end rendering benchmark |
| Distribution sync | Generated compatibility and README views match their authored sources |
| Catalog build | Astro can generate all catalog pages and assets |

Install the checksum-verified Waza version documented in
[`evals/README.md`](evals/README.md), then run:

```sh
waza run --no-cache --no-summary
waza tokens check --strict
for skill in skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  id=${skill#skills/}
  waza spec verify --skill "$skill" --eval "evals/$id/eval.yaml" --fail
done
```

`waza spec verify` maps documented requirements to task coverage; a passing
coverage check does not prove that an agent completed those behaviors.
CI keeps these deterministic checks separate from credentialed evaluations.

### Run agent evaluations manually

The **Skill Eval** workflow runs daily at **03:00 UTC** and accepts a manual
dispatch. To evaluate one skill, or omit `-f skill=...` to evaluate all skills:

```sh
gh workflow run skill-eval.yml --repo codebytes/skills --ref main -f skill=create-skill
gh run list --repo codebytes/skills --workflow skill-eval.yml --limit 5
gh run watch <run-id> --repo codebytes/skills
```

The workflow grants `copilot-requests: write` and retains per-skill evaluation
results as workflow artifacts. GitHub/Copilot policy and entitlement must permit
the requests. Dispatching the workflow consumes agent usage.

For a local run, authenticate the Copilot client used by the SDK or set
`COPILOT_GITHUB_TOKEN` securely with Copilot request access. A token returned by
`gh auth token` does not necessarily have that permission. Never save tokens in
repository files. After installing the root Vally toolchain:

```sh
.github/tools/vally/node_modules/.bin/vally eval \
  --eval-spec skills/create-skill/evals/create-skill/eval.yaml \
  --skill-dir skills/create-skill \
  --output-dir skills/create-skill/vally-results \
  --runs 1 --workers 1 --max-retries 0 --junit
```

Replace `create-skill` in all three paths for another skill. Root
`evals/<name>/eval.yaml` files are **Waza** specs; Vally specs are inside
`skills/<name>/evals/<name>/`. These formats are not interchangeable.
Local skill scripts also provide `npm run eval --prefix skills/<name>` after
their dependencies are installed.

Vally's Copilot SDK depends transitively on Koffi. It is not needed by Waza or
the dependency-free helpers, but must not be removed from an evaluator lockfile
to work around a package-feed failure. The Vally 0.16 skill toolchains pin
Koffi **3.2.1** and Hono **4.13.7** through npm overrides because the configured
Microsoft feed did not serve the previously locked 3.3.0/4.13.8 releases.
Both pins satisfy their parents' declared dependency ranges. Reassess the
overrides when the feed has the newer artifacts; regenerate locks with npm
and verify a clean install before removing them. Do not add a public-registry
override or HTTP proxy setting to this repository.

Build the catalog without deploying it:

```sh
npm ci --prefix site --ignore-scripts
npm run build --prefix site
```

## Catalog

The catalog lives in `site/`. Preview it locally before publishing:

```sh
npm ci --prefix site --ignore-scripts
npm run dev --prefix site
```

Publishing requires separate owner approval. The generated Pages workflow never runs on pull requests.

## Adding a skill

Use the bundled `create-skill` skill. Individual skill authoring does not
belong to the repository lifecycle tool.

## License

MIT. See [LICENSE](LICENSE).
