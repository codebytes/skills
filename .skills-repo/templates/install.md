## Install

Browse the [Codebytes Skills catalog](https://codebytes.github.io/skills) to explore the available skills.
Use **one installation method per client** and review skill instructions before
enabling them. Installation does not grant permission to run every bundled script.

### GitHub Copilot CLI

```sh
copilot plugin marketplace add {{repository}}
copilot plugin install {{packageName}}@{{packageName}}
```

### Standalone skills

Use the [Skills CLI](https://skills.sh/docs/cli) to select a skill and agent:

```sh
npx skills add {{repositoryUrl}} --skill marp-authoring
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
