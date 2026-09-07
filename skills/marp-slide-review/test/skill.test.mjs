import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildGallery, parseArgs, sortSlideImages } from "../scripts/render-review.mjs";

const skill = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");

test("portable skill frontmatter contains only name and description", () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter);
  const keys = [...frontmatter[1].matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);
  assert.deepEqual(keys, ["name", "description"]);
  assert.match(frontmatter[1], /^name: marp-slide-review$/m);
});

test("skill includes workflow, safety, and exit criteria", () => {
  assert.match(skill, /^## Workflow$/m);
  assert.match(skill, /^## Safety$/m);
  assert.match(skill, /^## Exit Criteria$/m);
});

test("review renderer creates a complete gallery", () => {
  const html = buildGallery({
    deck: "/tmp/deck.md",
    images: ["slide.001.png", "slide.002.png"],
    pdf: "deck.pdf",
    warnings: ["runtime Mermaid detected"],
  });
  assert.match(html, /Slide 1/);
  assert.match(html, /slide\.002\.png/);
  assert.match(html, /Download PDF/);
  assert.match(html, /runtime Mermaid detected/);
});

test("review renderer parses PDF and local-file options", () => {
  assert.deepEqual(
    parseArgs([
      "--theme-set", "slides/themes",
      "--output", "review",
      "--allow-local-files",
      "--pdf",
      "--browser", "chrome",
      "--json",
      "slides/Slides.md",
    ]),
    {
      deck: "slides/Slides.md",
      themeSet: "slides/themes",
      output: "review",
      allowLocalFiles: true,
      pdf: true,
      browser: "chrome",
      json: true,
      help: false,
    },
  );
});

test("review renderer sorts padded and unpadded slide images numerically", () => {
  assert.deepEqual(
    sortSlideImages(["slide.10.png", "slide.2.png", "slide.001.png", "slide.11.png"]),
    ["slide.001.png", "slide.2.png", "slide.10.png", "slide.11.png"],
  );
});

test("review skill bundles visual and PDF checklists", async () => {
  for (const relative of [
    "../references/pdf-parity.md",
    "../references/visual-checklist.md",
  ]) {
    assert.ok((await readFile(new URL(relative, import.meta.url), "utf8")).length > 0);
  }
});
