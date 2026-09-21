# Applying a Generated Theme

`apply_marp_theme.py` changes only top-level frontmatter:

- Ensures `marp: true`
- Updates `theme: <generated-theme>`
- Optionally applies `size: pptx-template`

It does not rewrite:

- Slide content
- Slide order
- Speaker notes
- Local directives
- Image references
- Custom HTML

The slide body, UTF-8 BOM when present, and line endings are preserved.
Quoted scalar keys and folded/literal theme values are supported; duplicate
keys, non-scalar theme values, and multiline quoted values are rejected. All supplied decks are parsed
before any writes begin, so a malformed later deck does not update earlier ones.

Always run without `--write` first. Review:

- Previous and proposed theme names
- Previous and proposed size
- Existing `_class` directives
- Classes not implemented by the generated CSS
- Missing files referenced by CSS `url(...)`

Register the generated CSS in the repository's Marp CLI configuration and
editor settings. Render representative slide types before applying it to every
deck.

Selected logo and background images are normally embedded as data URIs so
exported HTML and PDF do not depend on the output directory matching the theme
directory. Original media remains available beside the extraction report.
