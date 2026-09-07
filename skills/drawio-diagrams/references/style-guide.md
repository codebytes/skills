# Style Guide

Use semantic color roles consistently:

| Role | Fill | Stroke |
|---|---|---|
| Primary process or service | `#dae8fc` | `#6c8ebf` |
| Success or completed state | `#d5e8d4` | `#82b366` |
| Decision or warning | `#fff2cc` | `#d6b656` |
| Failure or blocked state | `#f8cecc` | `#b85450` |
| External or neutral system | `#f5f5f5` | `#666666` |
| Data store | `#e1d5e7` | `#9673a6` |

Guidelines:

- Use `whiteSpace=wrap;html=1`.
- Keep one visual meaning per color.
- Use 40-60 pixels between shapes in the same row.
- Use 80-120 pixels between major tiers.
- Prefer orthogonal edges for architecture and flow diagrams.
- Avoid crossing connectors and connectors that pass through shapes.
- Use dashed borders or edges for optional, external, or asynchronous relationships.
- Keep labels short; move explanations into surrounding documentation.
- Use 12-16px text for slide diagrams and validate it at rendered slide size.
- Use a descriptive diagram title and accessible description.

The helper supports basic static shapes. Raw `style` values are embedded into
the draw.io model but may require a draw.io re-export for the standalone SVG to
reflect specialized libraries.
