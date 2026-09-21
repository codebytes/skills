# Waza trigger evaluations

These suites validate skill routing independently from the agent-driven Vally
capability evaluations stored inside each skill.

- Waza uses the deterministic `mock` executor and `trigger` grader.
- Every skill has positive and negative trigger tasks under `evals/<skill>/`.
- `waza spec verify` ensures every `USE FOR` and `DO NOT USE FOR` phrase has
  task coverage.
- No model credentials or Copilot requests are required.

These are offline trigger-grader checks, not a measurement of live-agent routing
accuracy. Requirement coverage records a mapping between instructions and tasks;
it does not prove that an agent executed the instruction. Keep agent-driven
Vally specs under `skills/<name>/evals/<name>/`, not in this directory.

`.waza.yaml` explicitly caps `SKILL.md` at 5,000 tokens, consistent with the
[Agent Skills progressive-disclosure guidance](https://agentskills.io/specification#progressive-disclosure)
and the repository's existing 5,000-token fallback. Without that explicit rule,
Waza applies its own 500-token `SKILL.md` default rather than the fallback.
README files have a 3,000-token limit and other Markdown files a 2,000-token
limit. Waza 0.38.7 matches override filenames literally, so `SKILL.md` is used
instead of a glob in `overrides`. Repository tests also enforce the recommended
500-line instruction limit.

Run all trigger evaluations:

```sh
waza run --no-cache --no-summary
waza tokens check --strict
```

Verify requirement coverage:

```sh
for skill in skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  id=${skill#skills/}
  waza spec verify \
    --skill "$skill" \
    --eval "evals/$id/eval.yaml" \
    --fail
done
```

Waza is pinned to v0.38.7 with a platform-specific checksum in
`.github/workflows/waza-eval.yml`.

For a local installation, download the matching OS/architecture binary and
`checksums.txt` from the [v0.38.7 release](https://github.com/microsoft/waza/releases/tag/v0.38.7).
Verify that binary against its own checksum before making it executable or
adding it to `PATH`. The Linux CI checksum must not be used for macOS or Windows.

## Quality-gate reference

The review also compared
[Azure Copilot's PR checks](https://github.com/microsoft/GitHub-Copilot-for-Azure/blob/97bd97707793b00186c4cc6d1af7ac3b0d2c3a3b/.github/workflows/pr.yml)
and [agent-eval workflow](https://github.com/microsoft/GitHub-Copilot-for-Azure/blob/97bd97707793b00186c4cc6d1af7ac3b0d2c3a3b/.github/workflows/eval.yml).
This repository applies the relevant separation of frontmatter/reference checks,
manifest and catalog consistency, deterministic tests, token budgets, and
credentialed evals. Azure-specific graders, deployment tests, and build-time
version stamping are not requirements for these standalone portable skills.
