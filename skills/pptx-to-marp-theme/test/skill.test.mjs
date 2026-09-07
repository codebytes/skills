import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skill = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");

test("portable skill frontmatter contains only name and description", () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter);
  const keys = [...frontmatter[1].matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);
  assert.deepEqual(keys, ["name", "description"]);
  assert.match(frontmatter[1], /^name: pptx-to-marp-theme$/m);
});

test("skill includes workflow, safety, and exit criteria", () => {
  assert.match(skill, /^## Workflow$/m);
  assert.match(skill, /^## Safety$/m);
  assert.match(skill, /^## Exit Criteria$/m);
});

test("skill bundles extraction, application, and reference guidance", async () => {
  for (const relative of [
    "../scripts/apply_marp_theme.py",
    "../scripts/extract_pptx_theme.py",
    "../references/asset-selection.md",
    "../references/font-licensing.md",
    "../references/limitations.md",
    "../references/pptx-ooxml-map.md",
    "../references/theme-application.md",
  ]) {
    assert.ok((await readFile(new URL(relative, import.meta.url), "utf8")).length > 0);
  }
});
