# Chart Design

- Give the chart a conclusion-oriented title.
- Label units and time ranges explicitly.
- Start bar charts at zero unless a non-zero baseline is essential and clearly marked.
- Sort unordered categories by value.
- Keep series count low; more than four series is usually too much for a slide.
- Use direct labels where possible.
- Use a legend only when direct labels would overlap.
- Avoid 3D effects, dual axes, gradients that imply magnitude, and decorative grid lines.
- Preserve the JSON or source dataset beside the SVG.
- Include a source note on the slide or in the SVG.
- Use the same colors for the same concepts throughout a deck.
- Test labels and values at the final projected size.

`scripts/chart-to-svg.mjs` supports grouped bar and line charts. Use a dedicated
data-visualization tool for scatter plots, distributions, maps, statistical
intervals, or other analytical charts.
