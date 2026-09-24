import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validatePng } from "../.skills-repo/lib/png.mjs";
import { readSkillDescription } from "../.skills-repo/lib/skill-description.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(join(root, "skills-repo.config.json"), "utf8"));
const read = (file) => readFileSync(join(root, file), "utf8");
const skills = readdirSync(join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join(root, "skills", entry.name, "SKILL.md")))
  .map((entry) => entry.name).sort();

function markdownFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "vally-results", ".results"].includes(entry.name)) return [];
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return markdownFiles(file);
    return entry.isFile() && entry.name.endsWith(".md") ? [file] : [];
  });
}

function linkTargets(text) {
  let fence = null;
  const targets = [];
  for (const line of text.split(/\r?\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker) { fence = marker[1]; continue; }
    for (const match of line.matchAll(/\[[^\]]*\]\((<?[^\s)]+>?)(?:\s+["'][^"']*["'])?\)/g)) {
      const target = match[1].replace(/^<|>$/g, "");
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
      targets.push(decodeURIComponent(target.split("#")[0]));
    }
  }
  return targets;
}

test("all skills have complete portable packages and bounded routing descriptions", () => {
  assert.ok(skills.length > 0);
  for (const name of skills) {
    const base = `skills/${name}`;
    const source = read(`${base}/SKILL.md`);
    const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    assert.ok(frontmatter, `${name}: missing frontmatter`);
    assert.deepEqual([...frontmatter.matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]), ["name", "description"]);
    assert.match(frontmatter, new RegExp(`^name: ${name}$`, "m"));
    const description = readSkillDescription(source);
    assert.ok(description && description.length <= 1024, `${name}: invalid routing description`);
    assert.match(description, /USE FOR:.*DO NOT USE FOR:/);
    assert.ok(source.split("\n").length <= 500, `${name}: move long reference material out of SKILL.md`);
    for (const file of [
      "README.md", "LICENSE", "package.json", "package-lock.json", ".vally.yaml",
      "thumbnail.png", `evals/${name}/eval.yaml`,
    ]) assert.ok(existsSync(join(root, base, file)), `${name}: missing ${file}`);
    assert.ok(readdirSync(join(root, base, "test")).some((file) => /\.test\.mjs$/.test(file)), `${name}: no deterministic tests`);
    const pkg = JSON.parse(read(`${base}/package.json`));
    const lock = JSON.parse(read(`${base}/package-lock.json`));
    assert.equal(pkg.name, name);
    assert.equal(lock.name, name);
    assert.deepEqual(lock.packages[""].dependencies, pkg.dependencies);
    assert.deepEqual(lock.packages[""].devDependencies, pkg.devDependencies);
    for (const dependency of ["@microsoft/vally-cli", "@github/copilot-sdk", "koffi"]) {
      assert.ok(!lock.packages[`node_modules/${dependency}`], `${name}: evaluation dependency leaked into runtime tooling`);
    }
    validatePng(readFileSync(join(root, base, "thumbnail.png")));
    assert.ok(read(`${base}/README.md`).includes(`npx skills add ${config.owner.login}/${config.repository.name} --skill ${name}`),
      `${name}: README installs a different skill or repository`);
  }
});

test("every skill has a matching Vally capability suite, separate from Waza", () => {
  for (const name of skills) {
    const source = read(`skills/${name}/evals/${name}/eval.yaml`);
    assert.match(source, new RegExp(`^name: ${name}$`, "m"));
    assert.match(source, /^type: capability$/m);
    assert.match(source, /^\s+executor: copilot-sdk$/m);
    const stimuli = source.split(/^  - name: /m).slice(1);
    assert.ok(stimuli.length > 0, `${name}: no capability stimuli`);
    const names = stimuli.map((stimulus) => stimulus.split("\n")[0].trim());
    assert.equal(new Set(names).size, names.length, `${name}: duplicate stimulus names`);
    for (const stimulus of stimuli) {
      assert.match(stimulus, /type: skill-invocation/);
      assert.ok(stimulus.includes(`required: [${name}]`), `${name}: wrong required skill`);
      assert.match(stimulus, /type: diff-empty/, `${name}: no no-write regression grader`);
    }
    assert.match(read(`evals/${name}/eval.yaml`), /^\s+executor: mock$/m);
  }
});

test("documentation links exist and skills do not depend on files outside their package", () => {
  const files = [
    "README.md", "site/README.md", "evals/README.md", ".skills-repo/templates/install.md",
    ...markdownFiles("docs"),
    ...markdownFiles("skills"),
  ];
  for (const file of files) {
    const base = file.startsWith(".skills-repo/templates/") ? root : dirname(join(root, file));
    const skill = file.match(/^skills\/([^/]+)\//)?.[1];
    const boundary = realpathSync(skill ? join(root, "skills", skill) : root);
    for (const target of linkTargets(read(file))) {
      const absolute = resolve(base, target);
      assert.ok(existsSync(absolute), `${file}: broken local link ${target}`);
      const inside = relative(boundary, realpathSync(absolute));
      assert.ok(!isAbsolute(inside) && inside !== ".." && !inside.startsWith("../") && !inside.startsWith("..\\"),
        `${file}: link escapes its package: ${target}`);
    }
  }
});

test("README stays concise and links to preserved installation and maintenance guidance", () => {
  const readme = read("README.md");
  const guide = read("docs/guide.md");
  assert.ok(readme.trimEnd().split("\n").length <= 100, "keep detailed guidance out of the README");
  assert.doesNotMatch(guide, /\{\{[^}]+\}\}/);
  for (const match of readme.matchAll(/docs\/guide\.md#([a-z-]+)/g)) {
    const headings = [...guide.matchAll(/^#{1,6} (.+)$/gm)]
      .map((heading) => heading[1].trim().toLowerCase().replaceAll(" ", "-"));
    assert.ok(headings.includes(match[1]), `missing guide section: ${match[1]}`);
  }
  assert.match(guide, /skills\/marp-authoring\/evals\/marp-authoring\/eval\.yaml/);
  assert.match(guide, /gh workflow run skill-eval.yml --repo codebytes\/skills --ref main/);
  assert.match(guide, /copilot plugin update codebytes-skills@codebytes-skills/);
  assert.match(guide, /codex plugin marketplace upgrade codebytes-skills/);
});

test("documentation link scanning ignores examples but retains real asset links", () => {
  assert.deepEqual(linkTargets([
    "[Guide](references/guide.md#heading)", "![Asset](assets/chart.svg)",
    "[External](https://example.com)", "[Anchor](#here)",
    "````markdown", "[Example](missing.md)", "```", "[Still an example](missing.md)", "````",
  ].join("\n")), ["references/guide.md", "assets/chart.svg"]);
});

test("catalog skill entries reference the canonical generated thumbnails", () => {
  if (!config.catalog.enabled) return;
  const entries = readdirSync(join(root, "site/src/content/skills")).filter((file) => file.endsWith(".md")).sort();
  assert.deepEqual(entries, skills.map((name) => `${name}.md`));
  for (const name of skills) {
    const source = read(`site/src/content/skills/${name}.md`);
    assert.match(source, new RegExp(`^repoPath: skills/${name}$`, "m"));
    assert.match(source, new RegExp(`^thumb: images/thumb-${name}\\.png$`, "m"));
  }
});
