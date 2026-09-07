# marp-authoring

Create and revise Marp decks with reliable slide structure, content transformations, speaker notes, layouts, and existing theme styles.

## Install

```sh
npx skills add codebytes/skills --skill marp-authoring
```

Reload your agent skills, then invoke `/marp-authoring`.

## Usage

Use this skill to add, remove, split, merge, reorder, rewrite, or restyle Marp
slides while preserving frontmatter, directives, assets, and speaker notes.

Inspect a deck before and after editing:

```sh
node scripts/inspect-deck.mjs ../../slides/Slides.md
node scripts/inspect-deck.mjs --json ../../slides/Slides.md
```

Copy `assets/deck-template.md` when starting a new deck.

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
