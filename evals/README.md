# Waza trigger evaluations

These suites validate skill routing independently from the agent-driven Vally
capability evaluations stored inside each skill.

- Waza uses the deterministic `mock` executor and `trigger` grader.
- Every skill has positive and negative trigger tasks under `evals/<skill>/`.
- `waza spec verify` ensures every `USE FOR` and `DO NOT USE FOR` phrase has
  task coverage.
- No model credentials or Copilot requests are required.

Run all trigger evaluations:

```sh
waza run --no-cache --no-summary
```

Verify requirement coverage:

```sh
for skill in skills/*; do
  id=${skill#skills/}
  waza spec verify \
    --skill "$skill" \
    --eval "evals/$id/eval.yaml" \
    --fail
done
```

Waza is pinned to v0.38.7 with a platform-specific checksum in
`.github/workflows/waza-eval.yml`.
