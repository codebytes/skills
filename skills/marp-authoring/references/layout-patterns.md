# Layout Patterns

Inspect the active theme before using a class. Never assume a class exists only
because another Marp repository defines it.

## Layout patterns

`columns`, `columns3`, and `small` are theme-specific examples, not built-in
Marp layouts. Use them only if the active theme implements them. The bundled
starter uses the built-in `default` theme and a Markdown comparison table.

| Pattern | Recommended structure |
|---|---|
| Title | `<!-- _class: lead -->` with one heading and short subtitle |
| Section divider | `lead` or `invert` with one framing sentence |
| Standard content | Heading plus up to five concise points |
| Two-column comparison | `<!-- _class: columns -->` and two `##` subsections |
| Three-part overview | `<!-- _class: columns3 -->` and three short subsections |
| Dense reference | `<!-- _class: small -->`, used only when splitting is worse |
| Full visual | Heading, one image, one conclusion in notes or a short caption |
| Split visual | Background image syntax or an existing split-layout class |
| Quote | One quotation, attribution, and source |
| Closing | `lead` with one takeaway and one next step |

## Selection rules

- Use plain Markdown before custom HTML.
- Use a full-slide visual when the audience must inspect the visual.
- Use columns for parallel ideas, not sequential steps.
- Use a process diagram for sequence; do not force sequence into equal columns.
- Use `small` only for references, legal text, or unavoidable dense material.
- Keep layout markup stable when rewriting content.

## Custom HTML

Use semantic elements and existing theme classes. Avoid arbitrary nested
containers, fixed pixel positioning, and per-slide CSS systems. If a pattern is
reused across the deck, move it into the theme rather than duplicating inline
styles.
