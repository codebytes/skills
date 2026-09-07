import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build, extract, validateSpec } from "../scripts/make-drawio-svg.mjs";
import { validateDocument } from "../scripts/validate-drawio.mjs";

const skill = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");

test("portable skill frontmatter contains only name and description", () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter);
  const keys = [...frontmatter[1].matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);
  assert.deepEqual(keys, ["name", "description"]);
  assert.match(frontmatter[1], /^name: drawio-diagrams$/m);
});

test("skill includes workflow, safety, and exit criteria", () => {
  assert.match(skill, /^## Workflow$/m);
  assert.match(skill, /^## Safety$/m);
  assert.match(skill, /^## Exit Criteria$/m);
});

test("generator renders accessible basic shapes and orthogonal edges", () => {
  const svg = build({
    title: "Decision flow",
    description: "A start state routes through a decision to storage.",
    nodes: [
      { id: "start", label: "Start", x: 20, y: 80, width: 100, height: 50, shape: "ellipse" },
      { id: "choice", label: "Valid?", x: 190, y: 60, width: 120, height: 90, shape: "diamond" },
      { id: "store", label: "Database", x: 390, y: 70, width: 130, height: 70, shape: "cylinder" },
    ],
    edges: [
      { source: "start", target: "choice", orthogonal: true },
      { source: "choice", target: "store", label: "yes", orthogonal: true },
    ],
  });

  assert.match(svg, /role="img"/);
  assert.match(svg, /<title id="diagram-title">Decision flow<\/title>/);
  assert.match(svg, /<ellipse /);
  assert.match(svg, /<polygon /);
  assert.match(svg, /shape=cylinder3/);
  assert.match(svg, /M [^"]+ L [^"]+ L [^"]+ L /);
  assert.match(extract(svg), /^<mxfile/);
  assert.deepEqual(validateDocument(svg).errors, []);
});

test("spec validation rejects unsafe or inconsistent graphs", () => {
  const baseNode = { id: "node", label: "Node", x: 0, y: 0, width: 100, height: 50 };
  assert.throws(
    () => validateSpec({ title: "Duplicate", nodes: [baseNode, { ...baseNode }] }),
    /Duplicate cell id/,
  );
  assert.throws(
    () => validateSpec({ title: "Bad color", nodes: [{ ...baseNode, fill: '" onload="alert(1)' }] }),
    /six-digit hex color/,
  );
  assert.throws(
    () => validateSpec({
      title: "Bad edge",
      nodes: [baseNode],
      edges: [{ source: "node", target: "missing" }],
    }),
    /unknown target/,
  );
});

test("validator catches malformed cell relationships", () => {
  const invalid = `<mxfile><diagram id="p" name="Page"><mxGraphModel><root>` +
    `<mxCell id="0"/><mxCell id="1" parent="0"/>` +
    `<mxCell id="a" value="A" style="rounded=1;" vertex="1" parent="missing">` +
    `<mxGeometry x="0" y="0" width="0" height="40" as="geometry"/></mxCell>` +
    `<mxCell id="e" edge="1" parent="1" source="a" target="missing">` +
    `<mxGeometry relative="1" as="geometry"/></mxCell>` +
    `</root></mxGraphModel></diagram></mxfile>`;
  const result = validateDocument(invalid);
  assert.ok(result.errors.some((error) => error.includes('unknown parent="missing"')));
  assert.ok(result.errors.some((error) => error.includes("invalid width")));
  assert.ok(result.errors.some((error) => error.includes('unknown target="missing"')));
});

test("bundled examples and references are valid", async () => {
  for (const relative of [
    "../assets/example.drawio.svg",
    "../assets/examples/service-architecture.drawio.svg",
    "../assets/examples/visual-routing.drawio.svg",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.deepEqual(validateDocument(source, relative).errors, []);
  }
  for (const relative of [
    "../references/layout-guide.md",
    "../references/shape-reference.md",
    "../references/style-guide.md",
    "../references/xml-structure.md",
  ]) {
    assert.ok((await readFile(new URL(relative, import.meta.url), "utf8")).length > 0);
  }
});
