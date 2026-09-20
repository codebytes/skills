## Install

Install the collection with **one method per client** to avoid duplicate skills.
Review the skill instructions and scripts before enabling them. Installation does
not grant permission to run every bundled script.

### Standalone skills

The community [Skills CLI](https://skills.sh/docs/cli) can list the collection or
install selected skills into an agent's supported skill directory:

```sh
npx skills add {{repositoryUrl}} --list
npx skills add {{repositoryUrl}} --skill csv-analysis
```

Use `--skill '*'` for the complete collection while retaining the agent-selection
prompt. The current installer's `--all` installs every skill to every agent without
prompts; do not use it for a single-client setup. Keep each skill's supporting
files with its `SKILL.md`; do not copy only the Markdown file.

### GitHub Copilot CLI

```sh
copilot plugin marketplace add {{repository}}
copilot plugin install {{packageName}}@{{packageName}}
```

For an individual skill, install `csv-analysis@{{packageName}}` instead.
Individual marketplace entries use Copilot/VS Code's skill-only compatibility
format; the complete collection is the portable Agent Plugins 1.0 package.

### Claude Code CLI

```sh
claude plugin marketplace add {{repository}}
claude plugin install {{packageName}}@{{packageName}}
```

The equivalent interactive commands start with `/plugin`. Claude uses
`.claude-plugin/marketplace.json`, which advertises the complete collection.

### Codex CLI

Use **Codex CLI 0.142.0 or newer** for this repository-root marketplace.

```sh
codex --version
codex plugin marketplace add {{repository}}
codex plugin list --available --json
codex plugin add {{packageName}}@{{packageName}}
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
gemini extensions install {{repositoryUrl}}
gemini skills list --all
```

Gemini discovers `skills/` automatically from the extension. No `skills` field,
MCP server, or `GEMINI.md` is required in this skills-only extension.

### VS Code

Use the Extensions view's `@agentPlugins` filter. Add `{{repository}}` to the
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
`skills/` directory, or **Manage External Registries** to add `{{repositoryUrl}}`.
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
| Copilot CLI marketplace | Run `copilot plugin marketplace update {{packageName}}`, then `copilot plugin update {{packageName}}@{{packageName}}`. Substitute the individual skill name if installed separately. |
| Copilot CLI direct Git URL | Run `copilot plugin update {{packageName}}`; no marketplace suffix is needed for a direct install. |
| Claude Code | Run `claude plugin marketplace update {{packageName}}`, then `claude plugin update {{packageName}}@{{packageName}}`. |
| Codex CLI | Run `codex plugin marketplace upgrade {{packageName}}` to refresh the catalog. On clients with `plugin add/remove` but no `plugin update`, remove and re-add the qualified plugin as shown below. |
| Gemini extension | Run `gemini extensions update {{packageName}}`, then restart Gemini. `/skills reload` refreshes skill discovery; it does not download extension updates. |
| VS Code | Update from the original source. Use Copilot CLI for a CLI-managed install; use the Agent Plugins UI's available update actions for a VS Code-managed install. |
| Rider | Refresh the configured source in Skills settings and replace/update the installed copy at its original scope. A local source directory and an IDE-installed copy are different things. Verify with **Try in chat**. |
| ChatGPT | Use the Plugins UI and the workspace's marketplace-sync process where available; local CLI updates do not guarantee a workspace-managed plugin update. |

For Codex CLI versions with `plugin add/remove` but no `plugin update`:

```sh
codex plugin marketplace upgrade {{packageName}}
codex plugin remove {{packageName}}@{{packageName}}
codex plugin add {{packageName}}@{{packageName}}
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
- [Rider skills](https://www.jetbrains.com/help/rider/AI_skills_hooks.html),
  [AI Assistant Skills Manager](https://www.jetbrains.com/help/ai-assistant/agent-skills.html),
  and [Junie skills](https://junie.jetbrains.com/docs/agent-skills.html).

### Maintaining these generated views

Edit `skills-repo.config.json` for repository identity and
`.skills-repo/templates/install.md` for the installation/update guidance above.
From the repository root:

```sh
node .skills-repo/sync.mjs --dry-run
node .skills-repo/sync.mjs --approve <hash-from-preview>
node .skills-repo/sync.mjs --check
```

This narrowly scoped sync updates the native Codex marketplace, this README's
installation/update sections, and their managed hashes. It preserves the generated
skill table and other manifests, rejects unexpected managed-file edits, and uses
the bundled atomic writer. It does not install clients, access the network, or
replace the full `create-skills-repo sync` lifecycle used after adding/removing
skills or changing repository identity. Run this local sync after that lifecycle
too, so the documentation and compatibility views remain current. The native
Codex marketplace intentionally retains its local-root source and requires a
client with the upstream root-local fix.
