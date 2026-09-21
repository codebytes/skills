import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildGallery, parseArgs, sortSlideImages } from "../scripts/render-review.mjs";
import { parseArgs as parseOverflowArgs, measureDocument } from "../scripts/check-overflow.mjs";

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
      html: false,
      pdf: true,
      browser: "chrome",
      json: true,
      help: false,
    },
  );
});

test("rendering requires explicit HTML opt-in and option values", () => {
  assert.equal(parseArgs(["deck.md"]).html, false);
  assert.equal(parseArgs(["--html", "deck.md"]).html, true);
  assert.equal(parseOverflowArgs(["deck.md"]).html, false);
  assert.equal(parseOverflowArgs(["--html", "deck.md"]).html, true);
  for (const flag of ["--theme-set", "--output", "--browser"]) {
    assert.throws(() => parseArgs(["deck.md", flag]), /requires a value/);
  }
});

test("overflow options reject values that would silently disable checks", () => {
  for (const flag of ["--threshold", "--wait"]) {
    for (const value of ["NaN", "Infinity", "-1", "garbage"]) {
      assert.throws(() => parseOverflowArgs([flag, value, "deck.md"]), /finite non-negative/);
    }
    assert.throws(() => parseOverflowArgs(["deck.md", flag]), /requires a value/);
    assert.throws(() => parseOverflowArgs([flag, "--json", "deck.md"]), /requires a value/);
  }
  assert.equal(parseOverflowArgs(["--threshold", "0", "deck.md"]).threshold, 0);
});

test("overflow measurement requires slides and respects the exact threshold", () => {
  const slide = (id, overflow) => ({
    id, scrollHeight: 720 + overflow, clientHeight: 720, scrollWidth: 1280, clientWidth: 1280,
    querySelector() { return { textContent: "Title" }; },
  });
  const doc = { querySelectorAll() { return [slide("2", 3), slide("1", 2), slide("helper", 90)]; } };
  assert.deepEqual(measureDocument(2, doc), [{ slide: 2, title: "Title", overflowY: 3, overflowX: 0 }]);
  assert.throws(() => measureDocument(2, { querySelectorAll() { return []; } }), /No Marp slides/);
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

test("a failed rerender does not delete the previous review", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "marp-preserve-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const deck = join(directory, "deck.md");
  const cli = join(directory, "stub.mjs");
  writeFileSync(deck, "---\nmarp: true\n---\n# Deck\n");
  writeFileSync(cli, 'console.error("render failed"); process.exitCode = 1;\n');
  writeFileSync(join(directory, "slide.001.png"), "previous image");
  writeFileSync(join(directory, "review-manifest.json"), JSON.stringify({ images: ["slide.001.png"], pdf: null }));
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../scripts/render-review.mjs", import.meta.url)), "--output", directory, deck],
    { encoding: "utf8", env: { ...process.env, MARP_CMD: cli } },
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /render failed/);
  assert.equal(readFileSync(join(directory, "slide.001.png"), "utf8"), "previous image");
  assert.ok(readdirSync(directory).includes("review-manifest.json"));
});
