import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseArgs as parseChartArgs, renderChart } from "../scripts/chart-to-svg.mjs";
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

test("chart data cannot silently coerce missing or nonnumeric values to zero", () => {
  const spec = (value) => ({
    type: "bar", title: "Observed values",
    series: [{ name: "Series", values: [{ label: "A", value }] }],
  });
  for (const value of [null, false, true, "", " ", "12", [], {}, undefined, NaN, Infinity]) {
    assert.throws(() => renderChart(spec(value)), /finite JSON number/);
  }
  assert.doesNotMatch(renderChart(spec(0)), /NaN|Infinity/);
  assert.doesNotMatch(renderChart(spec(-12)), /NaN|Infinity/);
  assert.throws(() => renderChart(spec(Number.MIN_VALUE)), /numeric range/);
  assert.throws(() => renderChart(spec(Number.MAX_VALUE)), /numeric range/);
});

test("visual CLIs require option values", () => {
  assert.throws(() => parseChartArgs(["chart.json", "-o"]), /requires a value/);
  for (const flag of ["-o", "--theme", "--background", "--width", "--height", "--scale"]) {
    assert.throws(() => parseMermaidArgs(["flow.mmd", flag]), /requires a value/);
  }
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

test("Mermaid rendering preserves prior output when conversion or accessibility validation fails", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "mermaid-output-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = join(directory, "flow.mmd");
  const output = join(directory, "flow.svg");
  const cli = join(directory, "stub.mjs");
  writeFileSync(input, "flowchart LR\naccTitle: Flow\naccDescr: A goes to B.\nA --> B\n");
  writeFileSync(output, "previous valid output");
  writeFileSync(cli, `
import { writeFileSync } from "node:fs";
const output = process.argv[process.argv.indexOf("-o") + 1];
writeFileSync(output, "<svg>no accessibility metadata</svg>");
`);
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../scripts/render-mermaid.mjs", import.meta.url)), input, "-o", output],
    { encoding: "utf8", env: { ...process.env, MERMAID_CLI_PATH: cli } },
  );
  assert.equal(result.status, 2);
  assert.match(result.stderr, /accessible title and description/);
  assert.equal(readFileSync(output, "utf8"), "previous valid output");
  assert.ok(!readdirSync(directory).some((file) => file.startsWith(".mermaid-render-")));
});
