import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderChart } from "../scripts/chart-to-svg.mjs";
import { parseArgs as parseMermaidArgs } from "../scripts/render-mermaid.mjs";

const skill = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");

test("portable skill frontmatter contains only name and description", () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter);
  const keys = [...frontmatter[1].matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);
  assert.deepEqual(keys, ["name", "description"]);
  assert.match(frontmatter[1], /^name: marp-visuals$/m);
});

test("skill includes workflow, safety, and exit criteria", () => {
  assert.match(skill, /^## Workflow$/m);
  assert.match(skill, /^## Safety$/m);
  assert.match(skill, /^## Exit Criteria$/m);
});

test("chart renderer creates accessible deterministic SVG", () => {
  const svg = renderChart({
    type: "bar",
    title: "Adoption <by quarter>",
    description: "Quarterly adoption rate",
    yLabel: "Percent",
    series: [
      {
        name: "Adoption",
        color: "#0969da",
        values: [
          { label: "Q1", value: 20 },
          { label: "Q2", value: 35 },
        ],
      },
    ],
  });

  assert.match(svg, /role="img"/);
  assert.match(svg, /Adoption &lt;by quarter&gt;/);
  assert.match(svg, /Quarterly adoption rate/);
  assert.match(svg, /Q1/);
  assert.doesNotMatch(svg, /NaN|undefined/);
});

test("Mermaid wrapper parses deterministic output options", () => {
  assert.deepEqual(
    parseMermaidArgs(["flow.mmd", "-o", "flow.svg", "--theme", "neutral", "--scale", "2"]),
    {
      input: "flow.mmd",
      output: "flow.svg",
      theme: "neutral",
      background: "transparent",
      width: null,
      height: null,
      scale: 2,
      help: false,
    },
  );
});

test("skill bundles visual design references", async () => {
  for (const relative of [
    "../assets/example-chart.json",
    "../assets/example-chart.svg",
    "../assets/example-flow.mmd",
    "../assets/example-flow.svg",
    "../references/accessibility.md",
    "../references/chart-design.md",
    "../references/choosing-a-visual.md",
    "../references/mermaid.md",
  ]) {
    assert.ok((await readFile(new URL(relative, import.meta.url), "utf8")).length > 0);
  }
});
