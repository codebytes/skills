# Font Licensing

PowerPoint themes normally identify fonts by family name. The presence of a font
name or embedded font file does not grant permission to redistribute it.

The extractor:

- Reports major and minor font-family names.
- Reports additional typeface usage.
- Lists embedded font or presentation embedding files.
- Does not copy embedded font binaries.

Choose one of:

1. Use the original font when all presentation environments already license it.
2. Use a licensed web font and add an explicit `@font-face`.
3. Substitute a metrically similar system font.
4. Use a portable stack such as Arial, Helvetica, or sans-serif.

After substitution, inspect title wrapping, column density, tables, and code
blocks. Font metrics can materially change overflow.
