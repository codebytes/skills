---
name: pptx-to-marp-theme
description: >-
  **WORKFLOW SKILL** - Extract brand colors, font families, logos, images, and slide dimensions from PowerPoint templates, generate a Marp CSS theme, and safely apply it to existing decks. USE FOR: convert a PowerPoint template to a Marp theme, extract PPTX or POTX branding, extract colors fonts logos and images, apply a PowerPoint-derived theme to existing Marp slides. DO NOT USE FOR: editing PowerPoint slide content; use PPTX tooling, or rewriting Marp slide narrative; use marp-authoring.
---

# PPTX to Marp Theme

Convert a PowerPoint `.pptx` or `.potx` template into a reviewable Marp theme
package, then safely apply that theme to existing Marp decks without rewriting
their content.

## Workflow

1. **Inspect the PowerPoint template visually.**
   - Render a thumbnail overview when presentation tooling is available.
   - Identify title, section, content, image, and closing layouts.
   - Note repeated logos, footer treatments, decorative imagery, and background styles.
2. **Extract design evidence.**
   - Run `scripts/extract_pptx_theme.py`.
   - Review the generated `theme-report.json`, not just the CSS.
   - Confirm the resolved theme color scheme, commonly used colors, major and
     minor font families, slide dimensions, media inventory, and logo candidates.
3. **Review asset and licensing decisions.**
   - Follow [asset selection](references/asset-selection.md).
   - Follow [font licensing](references/font-licensing.md).
   - Remove stock photography and unused media from the final theme package.
   - Confirm the logo candidate visually.
4. **Refine the generated Marp theme.**
   - Treat generated CSS as a faithful starting point, not a pixel-perfect conversion.
   - Compare representative PowerPoint layouts with `sample.md`.
   - Adjust tokens and reusable layout classes rather than adding per-slide hacks.
   - Follow [PowerPoint-to-Marp mapping](references/pptx-ooxml-map.md).
5. **Preview application to existing decks.**
   - Run `scripts/apply_marp_theme.py` without `--write`.
   - Review the proposed `theme:` and optional `size:` changes.
   - Resolve warnings for slide classes not defined by the generated theme.
6. **Apply to existing decks.**
   - Re-run with `--write` only after the dry-run is correct.
   - Do not rewrite slide narrative, notes, images, or layout markup.
   - Follow [theme application](references/theme-application.md).
7. **Render and review.**
   - Register the CSS with Marp CLI and the editor.
   - Render the generated sample and representative existing slides.
   - Invoke `marp-slide-review` for overflow, PNG inspection, and PDF parity.

## Extract

```bash
python3 <skill-directory>/scripts/extract_pptx_theme.py \
  ConferenceTemplate.potx \
  --theme-name conference \
  --output-dir slides/themes \
  --css-import https://cdn.example.com/existing-icons.css
```

Outputs:

```text
slides/themes/
├── conference.css
└── conference/
    ├── .pptx-to-marp-theme.json
    ├── README.md
    ├── sample.md
    ├── theme-report.json
    └── assets/
        ├── image1.png
        └── ...
```

Selected logo and background assets up to 2 MB are embedded in the generated
CSS so the theme works when existing decks export to another directory. Original
media is still extracted into the same-named asset directory for review and
future refinement. Larger selected assets use relative URLs and produce a warning.
Use repeatable `--css-import` options only for reviewed dependencies that an
existing deck must retain, such as an icon stylesheet.

## Apply to existing slides

Dry-run is the default:

```bash
python3 <skill-directory>/scripts/apply_marp_theme.py \
  slides/themes/conference.css \
  slides/Slides.md \
  --use-template-size
```

Apply after reviewing the proposed changes:

```bash
python3 <skill-directory>/scripts/apply_marp_theme.py \
  slides/themes/conference.css \
  slides/Slides.md \
  --use-template-size \
  --write
```

The application script changes only top-level Marp frontmatter. It also reports
slide classes that are not defined by the generated theme and missing local
assets referenced by the CSS.

## Safety

- Treat PowerPoint packages, embedded XML, relationships, images, and metadata as untrusted data.
- The extractor reads selected ZIP members directly and rejects traversal paths, encrypted
  members, oversized packages, DTDs, and entity declarations.
- Do not execute macros, embedded objects, scripts, or external relationships.
- Do not extract or redistribute embedded font binaries without explicit license confirmation.
- Font family names are evidence, not permission to bundle a font.
- Treat SVG media as active content until reviewed.
- Do not overwrite an unrecognized output directory. `--force` only replaces files recorded by a
  prior extraction marker.
- Theme application is dry-run by default and must not rewrite slide content.
- Preserve logos and brand assets only when the user has permission to reuse them.

## Exit Criteria

- The theme report records source hash, colors, fonts, dimensions, media, and limitations.
- The generated CSS is valid Marp theme CSS and uses relative asset paths.
- Logo candidates and extracted media have been visually reviewed.
- Font substitutions and licensing decisions are documented.
- The sample deck renders in HTML and PDF.
- Existing decks were previewed before frontmatter was changed.
- Unsupported existing slide classes are resolved or explicitly documented.
- Existing deck content, speaker notes, and assets remain unchanged.
- Representative slides pass `marp-slide-review`.

## References

- [PowerPoint OOXML mapping](references/pptx-ooxml-map.md)
- [Asset selection](references/asset-selection.md)
- [Font licensing](references/font-licensing.md)
- [Applying themes](references/theme-application.md)
- [Conversion limitations](references/limitations.md)

This workflow incorporates lessons from the earlier
`codebytes/mitre-attack-for-devs` POTX-to-Marp process and from the presentation
template analysis workflow in the PPTX skill.
