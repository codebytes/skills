# Conversion Limitations

- Slide-master geometry cannot be converted losslessly to semantic Marp layouts.
- PowerPoint effects such as SmartArt, charts, 3D, transitions, and animations
  are not translated.
- Logos made from grouped vector shapes are not extracted as standalone files.
- Embedded charts and diagrams may appear only as package parts, not reusable images.
- Theme color transforms such as tint, shade, and luminance adjustments are
  counted but not all are reproduced in generated CSS.
- Font family extraction does not ensure the font is installed or licensed.
- EMF and WMF media are unsuitable for direct browser use.
- Logo detection is heuristic.
- Generated CSS provides common Marp classes but cannot know every class used by
  existing decks.
- Visual comparison remains mandatory.
