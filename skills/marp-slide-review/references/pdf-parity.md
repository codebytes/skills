# PDF Parity

PDF uses the browser print path and can differ from screen or PNG rendering.

Compare at least:

- Title slide
- Densest text slide
- Largest chart or diagram
- Slide with shadows, filters, gradients, or transparency
- Slide with code or a table
- Closing slide

Check for:

- Missing local or remote assets
- Different line wrapping
- Lost blur or shadow effects
- Incorrect background colors
- Cropped images or code
- Blank runtime Mermaid containers
- Raster images that look soft at full-screen size
- Notes accidentally included or omitted

Prefer static SVG for diagrams and charts. Use `--pdf-notes` only when the
notes are intentionally part of the distributed PDF.
