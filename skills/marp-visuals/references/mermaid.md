# Mermaid Diagrams

Store Mermaid source as `.mmd` or `.mermaid` and render it to SVG before
embedding it in a deck:

```bash
node scripts/render-mermaid.mjs architecture.mmd -o architecture.svg
```

Include `accTitle` and `accDescr` in the source so the rendered SVG contains a
title and description:

```mermaid
flowchart LR
  accTitle: Reviewed release flow
  accDescr: A reviewed change moves from a passing build to a release.
  A[Passing build] --> B[Release]
```

The wrapper rejects missing accessibility metadata and preserves an existing
output if rendering fails. Set `CHROME_PATH` or `PUPPETEER_EXECUTABLE_PATH` when
using an installed browser with the locked, script-disabled npm installation.

Recommended diagram types:

- `flowchart` for processes and decisions
- `sequenceDiagram` for interactions over time
- `stateDiagram-v2` for state transitions
- `classDiagram` for conceptual type relationships
- `erDiagram` for data relationships
- `timeline` for milestones

Keep labels concise and use a left-to-right direction for wide 16:9 slides.
Prefer top-to-bottom when the diagram has many branches.

Do not rely on a runtime Mermaid `<script>` when exporting PDF or when the deck
must work offline. Runtime rendering may complete after Marp captures the slide.
Static SVG avoids that timing and network dependency.

If the diagram must remain editable in draw.io, invoke `drawio-diagrams`
instead of flattening it to SVG.
