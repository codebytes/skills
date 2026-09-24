# Codebytes Skills

Portable, tested agent skills for GitHub Copilot, Codex, Claude Code, Cursor, Gemini CLI, and other Agent Skills compatible hosts\.

## Skills

| Skill | What it does |
|---|---|
| [`drawio-diagrams`](skills/drawio-diagrams/) | \*\*WORKFLOW SKILL\*\* - Create, validate, and edit accessible draw\.io SVG diagrams that remain visually editable\. Supports basic flowchart and architecture shapes, semantic styling, orthogonal connectors, strict specification validation, and embedded mxGraph XML\. USE FOR: create a draw\.io diagram, create a \.drawio\.svg, make an editable architecture or flow diagram, validate draw\.io XML, use diagrams\.net\. DO NOT USE FOR: quick throwaway diagrams that do not need draw\.io editability; use Mermaid instead, or complex cloud/UML diagrams that require full draw\.io shape libraries; use draw\.io Desktop or jgraph/drawio-mcp\. |
| [`marp-authoring`](skills/marp-authoring/) | \*\*WORKFLOW SKILL\*\* - Create and revise Marp decks with reliable slide structure, content transformations, speaker notes, layouts, and existing theme styles\. USE FOR: create Marp slides, add a slide, rewrite slide content, split or merge slides, reorder a deck, add speaker notes, apply slide layouts, restyle slides\. DO NOT USE FOR: generating chart or diagram assets; use marp-visuals, or reviewing overflow and rendering; use marp-slide-review\. |
| [`marp-slide-review`](skills/marp-slide-review/) | \*\*WORKFLOW SKILL\*\* - Review rendered Marp slide decks for overflow, clipping, visual balance, asset failures, and HTML/PDF rendering differences\. USE FOR: review Marp slides, check slide overflow, inspect rendered slides, lint a deck layout, verify slides fit, compare PDF rendering\. DO NOT USE FOR: authoring slide content; use marp-authoring, or generating chart and diagram assets; use marp-visuals\. |
| [`marp-visuals`](skills/marp-visuals/) | \*\*WORKFLOW SKILL\*\* - Create deterministic charts, Mermaid diagrams, graphs, and accessible static visual assets for Marp decks\. USE FOR: add a chart to slides, build a graph, create a Mermaid diagram, turn data into a slide visual, generate SVG assets for Marp\. DO NOT USE FOR: editing slide narrative or layout; use marp-authoring, or creating diagrams that must remain editable in draw\.io; use drawio-diagrams\. |
| [`pptx-to-marp-theme`](skills/pptx-to-marp-theme/) | \*\*WORKFLOW SKILL\*\* - Extract brand colors, font families, logos, images, and slide dimensions from PowerPoint templates, generate a Marp CSS theme, and safely apply it to existing decks\. USE FOR: convert a PowerPoint template to a Marp theme, extract PPTX or POTX branding, extract colors fonts logos and images, apply a PowerPoint-derived theme to existing Marp slides\. DO NOT USE FOR: editing PowerPoint slide content; use PPTX tooling, or rewriting Marp slide narrative; use marp-authoring\. |

## Install

Browse the [Codebytes Skills catalog](https://codebytes.github.io/skills) to explore the available skills.
Use **one installation method per client** and review skill instructions before
enabling them. Installation does not grant permission to run every bundled script.

### GitHub Copilot CLI

```sh
copilot plugin marketplace add codebytes/skills
copilot plugin install codebytes-skills@codebytes-skills
```

### Standalone skills

Use the [Skills CLI](https://skills.sh/docs/cli) to select a skill and agent:

```sh
npx skills add https://github.com/codebytes/skills --skill marp-authoring
```

Use `--list` to browse or `--skill '*'` for the collection. Avoid `--all` for a
single-client setup: it installs every skill to every agent without prompts.

For **Claude Code, Codex, Gemini, VS Code, Rider**, and lean local plugins, see the
[installation guide](docs/guide.md#install). Codex CLI requires **0.142.0+**.
See [supported agents](docs/guide.md#supported-agents) for compatibility limits.

## Updating installed skills and plugins

Update through the same mechanism used to install, then start a new agent session.
Refreshing a marketplace catalog does not necessarily update installed copies.
See the [per-client update commands](docs/guide.md#updating-installed-skills-and-plugins).

## Validation

Skill helpers require Node.js **22.20+**; `pptx-to-marp-theme` also needs Python
**3.10+**. The catalog requires Node.js **24+** and npm **11.10+**.

```sh
npm ci --prefix .github/tools/vally --ignore-scripts
npm test --prefix .github/tools/vally
node .skills-repo/sync.mjs --check
```

See the guide for [skill tests and linting](docs/guide.md#validation),
[quality checks and agent evaluations](docs/guide.md#skill-quality), and
[maintaining generated views](docs/guide.md#maintaining-these-generated-views).

## Catalog

The catalog lives in `site/`. Preview it locally before publishing:

```sh
npm ci --prefix site --ignore-scripts
npm run dev --prefix site
```

Publishing requires separate owner approval. The generated Pages workflow never runs on pull requests.

## Adding a skill

Add a self-contained package under `skills/<name>/`, following the existing
skills. Include instructions, a README, a license, deterministic tests,
capability evals, and a thumbnail. Add its Waza trigger suite under `evals/<name>/`
and its catalog entry under `site/`. Catalog thumbnails are generated at build time.

Run the external `create-skills-repo sync` lifecycle, then the local compatibility
sync described above, to update generated registrations.

## License

MIT. See [LICENSE](LICENSE).
