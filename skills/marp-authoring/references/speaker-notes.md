# Speaker Notes

Marp presenter notes are HTML comments placed in the slide:

```markdown
## Visible conclusion

- One supporting point

<!--
Explain the example, caveat, and transition to the next slide here.
-->
```

Use notes for:

- Supporting explanation and examples
- Source details that would clutter the slide
- Timing and demonstration cues
- Caveats and anticipated questions
- Transitions between slides
- Content removed while condensing a source document

Do not use notes to hide essential context that the audience needs to
understand the visible slide. Preserve existing notes when moving, splitting,
or merging slides.

Avoid comments that look like Marp directives unless they are directives.
Local directives such as `<!-- _class: lead -->` belong immediately before the
content they affect.
