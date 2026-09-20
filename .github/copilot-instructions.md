- Canonical agent skills live under `skills/<name>/`.
- `skills-repo.config.json` and `.skills-repo/state.json` define the managed
  repository baseline. Do not hand-edit generated manifests, the root skill
  table, or generated Dependabot entries.
- Use the bundled `skills/create-skill` workflow when adding a skill. Run the
  `create-skills-repo sync` lifecycle command after adding or removing skills.
- Then run `node .skills-repo/sync.mjs --dry-run` and apply with
  `--approve <hash-from-preview>`.
  This local compatibility sync owns the Codex marketplace and the README's
  installation/update sections; edit `.skills-repo/templates/install.md`, not
  those generated sections. Use `--check` to detect stale generated views.
- Keep every skill self-contained with instructions, README, license,
  deterministic tests, capability eval, thumbnail, and optional scripts,
  references, and assets.
- Keep Vally capability evaluations inside each skill under `evals/<name>/`.
- Keep deterministic Waza trigger suites under root `evals/<name>/`.
- The catalog source lives under `site/` and requires Node.js 24 or newer.
