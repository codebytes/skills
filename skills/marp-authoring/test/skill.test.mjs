import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectDeck } from "../scripts/inspect-deck.mjs";

const skill = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");

test("portable skill frontmatter contains only name and description", () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter);
  const keys = [...frontmatter[1].matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);
  assert.deepEqual(keys, ["name", "description"]);
  assert.match(frontmatter[1], /^name: marp-authoring$/m);
});

test("skill includes workflow, safety, and exit criteria", () => {
  assert.match(skill, /^## Workflow$/m);
  assert.match(skill, /^## Safety$/m);
  assert.match(skill, /^## Exit Criteria$/m);
});

test("deck inspector preserves slide structure and reports density", () => {
  const report = inspectDeck(`---
marp: true
theme: custom-default
---

<!-- _class: lead -->
# Title

<!-- Speaker context -->

---

## Details

- One
- Two

![Architecture](img/architecture.svg)

---

<div class="mermaid">
flowchart LR
  A --> B
</div>
`);

  assert.equal(report.slides.length, 3);
  assert.equal(report.slides[0].title, "Title");
  assert.deepEqual(report.slides[0].classes, ["lead"]);
  assert.equal(report.slides[0].notes, 1);
  assert.equal(report.slides[1].images, 1);
  assert.equal(report.slides[2].mermaid, 1);
  assert.ok(report.slides[2].warnings.includes("runtime Mermaid"));
});

test("skill bundles the authoring reference set", async () => {
  for (const relative of [
    "../assets/deck-template.md",
    "../references/accessibility.md",
    "../references/content-operations.md",
    "../references/layout-patterns.md",
    "../references/speaker-notes.md",
    "../references/styling.md",
  ]) {
    assert.ok((await readFile(new URL(relative, import.meta.url), "utf8")).length > 0);
  }
});

test("deck inspection respects fence lengths and separators inside speaker notes", () => {
  const report = inspectDeck([
    "# Visible heading", "",
    "<!--", "# Hidden heading", "---", "![Hidden image](missing.svg)", "-->",
    "````markdown", "```", "---", "# Code example", "```", "````",
    "---", "# Next slide",
  ].join("\n"));
  assert.equal(report.summary.slides, 2);
  assert.equal(report.slides[0].title, "Visible heading");
  assert.equal(report.slides[0].images, 0);
  assert.equal(report.slides[0].notes, 1);
  assert.equal(report.slides[1].title, "Next slide");
});

test("code-only slides contain visible text, not notes or images", () => {
  const report = inspectDeck("```markdown\n<!-- Example -->\n![Sample](x.svg)\n- example\n```");
  assert.equal(report.slides[0].title, "(untitled)");
  assert.equal(report.slides[0].notes, 0);
  assert.equal(report.slides[0].images, 0);
  assert.equal(report.slides[0].bullets, 0);
  assert.ok(report.slides[0].words > 0);
  assert.ok(!report.slides[0].warnings.includes("empty slide"));
  assert.ok(!inspectDeck("```xml\n<element />\n```").slides[0].warnings.includes("empty slide"));
});

test("the starter deck uses a built-in theme and has no missing external assets", async () => {
  const source = await readFile(new URL("../assets/deck-template.md", import.meta.url), "utf8");
  assert.match(inspectDeck(source).frontmatter, /^theme: default$/m);
  assert.doesNotMatch(source, /!\[.*?\]\(img\/|_class: columns/);
});
