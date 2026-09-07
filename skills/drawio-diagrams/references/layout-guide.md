# Layout Guide

Plan the diagram before writing XML or JSON.

## Direction

- Left-to-right: pipelines, request flows, and transformations.
- Top-to-bottom: approval flows and staged processes.
- Tiers or swimlanes: system architecture and ownership boundaries.
- Radial or force-directed: use draw.io ELK tooling rather than manual coordinates.

## Spacing

- Align shapes to a 10 or 20 pixel grid.
- Keep 40-60 pixels between adjacent shapes.
- Keep 80-120 pixels between tiers.
- Use consistent sizes for equivalent components.
- Leave extra space around diamonds because their labels have less usable area.

## Edges

- Use orthogonal edges for architecture and flowcharts.
- Use straight edges only for sparse relationship diagrams.
- Label only meaningful transitions.
- Use dashed edges for optional or asynchronous relationships.
- Avoid placing labels directly over shapes or other connectors.

## Canvas

Keep the diagram's aspect ratio close to its destination. A Marp slide usually
benefits from a wide layout. Avoid very tall diagrams that become unreadable
when fitted into 16:9 slides.
