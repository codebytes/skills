# pptx-to-marp-theme

Extract brand colors, font families, logos, images, and slide dimensions from PowerPoint templates, generate a Marp CSS theme, and safely apply it to existing decks.

## Install

```sh
npx skills add codebytes/skills --skill pptx-to-marp-theme
```

Reload your agent skills, then invoke `/pptx-to-marp-theme`.

## Usage

Extract a PowerPoint template:

```sh
python3 scripts/extract_pptx_theme.py template.potx \
  --theme-name conference \
  --output-dir ./themes
```

Use `--css-import <https-url>` to preserve a reviewed stylesheet dependency
required by existing slides.

Preview applying the generated theme to an existing deck:

```sh
python3 scripts/apply_marp_theme.py \
  ./themes/conference.css \
  ../../slides/Slides.md \
  --use-template-size
```

Add `--write` only after reviewing the dry-run.

The extractor uses Python's standard library and does not require PowerPoint.
Visual comparison and final refinement still require rendering the original
template and generated Marp sample.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run eval:lint
```

The deterministic test checks the portable skill shape. The Vally capability eval verifies that
the agent follows the workflow.

## License

MIT. See [LICENSE](LICENSE).
