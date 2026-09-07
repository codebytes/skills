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

List or install skills with the portable skills installer:

```sh
npx skills add https://github.com/codebytes/skills --list
npx skills add https://github.com/codebytes/skills --all
```

Install the complete Agent Plugins package:

```sh
copilot plugin install https://github.com/codebytes/skills
```

## Supported agents

The canonical content lives in `skills/`. The repository includes discovery
manifests for GitHub Copilot, Codex, ChatGPT desktop, Claude Code, Cursor,
Gemini CLI, and Agent Plugins compatible hosts.

## Validation

```sh
npm ci --prefix .github/tools/vally --ignore-scripts
npm test --prefix .github/tools/vally
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
