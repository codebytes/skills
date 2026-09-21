# Styling

## Applying existing styles

1. Read the active theme and repository conventions.
2. Reuse existing slide classes, image selectors, and CSS variables.
3. Prefer local directives to one-off global changes.
4. Keep inline styles limited to a small adjustment that cannot be expressed by
   an existing class.

Common directive syntax (class names still depend on the active theme):

```markdown
<!-- _class: lead -->
<!-- _class: invert -->
<!-- _class: columns -->
<!-- _class: columns3 -->
<!-- _class: small -->
<!-- _paginate: skip -->
```

Only use classes that the active theme actually defines.

## Theme boundaries

- Do not edit theme CSS to make oversized content fit. Split or condense first.
- Do not change global typography or spacing for one slide.
- Do not duplicate a reusable pattern as inline CSS across several slides.
- Theme creation, token changes, and new reusable layout classes should be a
  separate theme-maintenance task.

## Visual consistency

- Use one dominant color and one accent per slide.
- Keep heading hierarchy, card radius, spacing, and image treatment consistent.
- Avoid low-contrast text, decorative rules under every title, and unexplained
  layout changes.
- Verify both screen and PDF rendering after changing shadows, filters,
  gradients, or web fonts.
