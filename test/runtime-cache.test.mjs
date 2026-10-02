import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runtimeFiles } from "../.skills-repo/package.mjs";
import { browserEnvironment, installRuntime, runtimeFile, runtimeInfo } from "../skills/marp-slide-review/scripts/setup-runtime.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const names = ["marp-slide-review", "marp-visuals"];

function put(path, content = "") {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function fixture(t) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "skills-cache-test-")));
  const plugin = join(directory, "plugin");
  for (const [path, bytes] of runtimeFiles(root)) put(join(plugin, path), bytes);
  const prior = process.env.CODEBYTES_SKILLS_CACHE;
  process.env.CODEBYTES_SKILLS_CACHE = join(directory, "external cache");
  t.after(() => {
    if (prior === undefined) delete process.env.CODEBYTES_SKILLS_CACHE;
    else process.env.CODEBYTES_SKILLS_CACHE = prior;
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, plugin, skill: join(plugin, "skills", names[0]) };
}

function snapshot(directory) {
  return readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return [path, readFileSync(path)];
    });
}

function runScript(plugin, name, script, args, env = {}) {
  const environment = { ...process.env, ...env };
  delete environment.MARP_CMD;
  delete environment.MERMAID_CLI_PATH;
  return spawnSync(process.execPath, [join(plugin, "skills", name, "scripts", script), ...args], {
    cwd: tmpdir(), encoding: "utf8", env: environment,
  });
}

test("standalone setup helpers stay identical and source/artifact copies share cache keys", (t) => {
  const { plugin } = fixture(t);
  assert.equal(
    readFileSync(join(root, "skills", names[0], "scripts/setup-runtime.mjs"), "utf8"),
    readFileSync(join(root, "skills", names[1], "scripts/setup-runtime.mjs"), "utf8"),
  );
  for (const name of names) {
    const skill = join(plugin, "skills", name);
    assert.equal(runtimeInfo(skill).directory, runtimeInfo(join(root, "skills", name)).directory);
    const info = runtimeInfo(skill);
    assert.equal(JSON.parse(info.manifest).scripts, undefined);
    put(join(skill, "package-lock.json"), info.lock + "\n");
    assert.notEqual(runtimeInfo(skill).directory, info.directory);
  }
});

test("setup installs the unchanged lock outside the plugin once, with scripts and browser downloads disabled", (t) => {
  const { plugin, skill } = fixture(t);
  const before = snapshot(plugin);
  let calls = 0;
  const run = (command, args, options) => {
    calls++;
    assert.equal(command, process.platform === "win32" ? "npm.cmd" : "npm");
    assert.deepEqual(args, ["ci", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund"]);
    assert.ok(options.cwd.startsWith(process.env.CODEBYTES_SKILLS_CACHE));
    assert.equal(options.env.PUPPETEER_SKIP_DOWNLOAD, "true");
    assert.equal(options.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD, "1");
    assert.equal(readFileSync(join(options.cwd, "package-lock.json"), "utf8"),
      readFileSync(join(skill, "package-lock.json"), "utf8"));
    put(join(options.cwd, "node_modules", "playwright", "index.mjs"), "export const chromium = {};");
  };
  const directory = installRuntime(skill, run);
  assert.equal(installRuntime(skill, run), directory);
  assert.equal(calls, 1);
  assert.equal(runtimeFile("playwright/index.mjs", skill), join(directory, "node_modules/playwright/index.mjs"));
  assert.deepEqual(snapshot(plugin), before);
  assert.ok(!existsSync(join(skill, "node_modules")));
});

test("failed installs clean staging and never publish a successful cache", (t) => {
  const { skill } = fixture(t);
  const info = runtimeInfo(skill);
  assert.throws(() => installRuntime(skill, (_command, _args, options) => {
    put(join(options.cwd, "node_modules", "partial"), "partial");
    throw new Error("feed unavailable");
  }), /feed unavailable/);
  assert.equal(existsSync(info.directory), false);
  assert.deepEqual(readdirSync(dirname(info.directory)), []);
  assert.throws(() => runtimeFile("playwright/index.mjs", skill), /setup-runtime\.mjs/);
  mkdirSync(info.directory);
  assert.throws(() => installRuntime(skill), /Incomplete runtime cache/);
});

test("concurrent publication reuses a complete winner without replacing it", (t) => {
  const { skill } = fixture(t);
  const info = runtimeInfo(skill);
  const result = installRuntime(skill, (_command, _args, { cwd }) => {
    put(join(cwd, "node_modules", "loser"), "staged");
    put(join(info.directory, "node_modules", "winner"), "completed");
    put(join(info.directory, ".ready"), info.key);
  });
  assert.equal(result, info.directory);
  assert.equal(readFileSync(join(result, "node_modules", "winner"), "utf8"), "completed");
  assert.equal(existsSync(join(result, "node_modules", "loser")), false);
  assert.deepEqual(readdirSync(dirname(result)), [info.key]);
});

test("optional browser setup runs the cached Playwright CLI with an external browser destination", (t) => {
  const { directory, plugin, skill } = fixture(t);
  const browsers = join(directory, "browser-cache");
  installRuntime(skill, (_command, _args, { cwd }) => {
    put(join(cwd, "node_modules/playwright/package.json"), '{"name":"playwright","main":"index.cjs"}');
    put(join(cwd, "node_modules/playwright/index.cjs"),
      'exports.chromium = { executablePath: () => process.env.PLAYWRIGHT_BROWSERS_PATH + "/chromium" };');
    put(join(cwd, "node_modules/playwright/cli.js"), `
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
assert.deepEqual(process.argv.slice(2), ["install", "chromium"]);
mkdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH, { recursive: true });
writeFileSync(process.env.PLAYWRIGHT_BROWSERS_PATH + "/chromium", "test browser");
`);
  });
  const before = snapshot(plugin);
  const result = runScript(plugin, names[0], "setup-runtime.mjs", ["--install-browser"], {
    PLAYWRIGHT_BROWSERS_PATH: browsers,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(`CHROME_PATH to: ${browsers}/chromium`));
  assert.ok(existsSync(join(browsers, "chromium")));
  assert.deepEqual(snapshot(plugin), before);
  const invalid = runScript(plugin, names[1], "setup-runtime.mjs", ["--install-browser"]);
  assert.equal(invalid.status, 2);
  assert.match(invalid.stderr, /requires the slide-review skill/);
});

test("cache and browser overrides cannot put dependencies in plugins, even through symlinks", (t) => {
  const { directory, plugin, skill } = fixture(t);
  for (const bad of [skill, join(plugin, "cache"), "relative-cache"]) {
    process.env.CODEBYTES_SKILLS_CACHE = bad;
    assert.throws(() => runtimeInfo(skill), /outside|absolute/);
  }
  const link = join(directory, "linked-cache");
  symlinkSync(plugin, link, process.platform === "win32" ? "junction" : "dir");
  process.env.CODEBYTES_SKILLS_CACHE = join(link, "cache");
  assert.throws(() => runtimeInfo(skill), /outside/);
  process.env.CODEBYTES_SKILLS_CACHE = join(directory, "external");
  mkdirSync(process.env.CODEBYTES_SKILLS_CACHE);
  symlinkSync(plugin, join(process.env.CODEBYTES_SKILLS_CACHE, "runtimes"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => runtimeInfo(skill), /outside/);
  process.env.CODEBYTES_SKILLS_CACHE = join(directory, "safe");
  const oldBrowser = process.env.PLAYWRIGHT_BROWSERS_PATH;
  t.after(() => {
    if (oldBrowser === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = oldBrowser;
  });
  for (const bad of ["0", join(plugin, "browsers"), join(link, "browsers")]) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = bad;
    assert.throws(() => browserEnvironment(skill), /outside|absolute/);
  }
  delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  assert.equal(browserEnvironment(skill).PLAYWRIGHT_BROWSERS_PATH, join(directory, "safe", "browsers"));
});

test("all rendering entrypoints use external dependencies from a lean plugin without writing into it", (t) => {
  const { directory, plugin } = fixture(t);
  const before = snapshot(plugin);
  const marp = `
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
let output = args[args.indexOf("-o") + 1];
if (args.includes("--images")) output = output.replace(/\\.png$/, ".001.png");
writeFileSync(output, args.includes("--pdf") ? "%PDF-test" : "<html>rendered</html>");
`;
  const playwright = `
export const chromium = { launch: async () => ({
  newPage: async () => ({
    route: async () => {}, goto: async () => {}, waitForTimeout: async () => {},
    evaluate: async (fn, threshold) => threshold === undefined ? undefined : []
  }), close: async () => {}
}) };
`;
  const mermaid = `
import { writeFileSync } from "node:fs";
writeFileSync(process.argv[process.argv.indexOf("-o") + 1],
  "<svg><title>Flow</title><desc>A to B</desc></svg>");
`;
  for (const name of names) {
    installRuntime(join(plugin, "skills", name), (_command, _args, { cwd }) => {
      put(join(cwd, "node_modules/@marp-team/marp-cli/marp-cli.js"), marp);
      put(join(cwd, "node_modules/playwright/index.mjs"), playwright);
      put(join(cwd, "node_modules/@mermaid-js/mermaid-cli/src/cli.js"), mermaid);
    });
  }
  const deck = join(directory, "deck.md");
  const diagram = join(directory, "flow.mmd");
  put(deck, "---\nmarp: true\n---\n# Deck\n");
  put(diagram, "flowchart LR\naccTitle: Flow\naccDescr: A to B\nA --> B\n");
  const output = join(directory, "review");
  const commands = [
    [names[0], "render-review.mjs", ["--output", output, "--pdf", "--json", deck]],
    [names[0], "check-overflow.mjs", ["--json", deck]],
    [names[1], "render-mermaid.mjs", [diagram, "-o", join(directory, "flow.svg")]],
  ];
  for (const [name, script, args] of commands) {
    const result = runScript(plugin, name, script, args, { PLAYWRIGHT_BROWSERS_PATH: join(directory, "browsers") });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.ok(existsSync(join(output, "slide.001.png")));
  assert.match(readFileSync(join(output, "deck.pdf"), "utf8"), /^%PDF/);
  assert.match(readFileSync(join(directory, "flow.svg"), "utf8"), /<title>Flow/);
  assert.deepEqual(snapshot(plugin), before);
});

test("missing cache fails explicitly rather than using skill-local node_modules or a PATH fallback", (t) => {
  const { directory, plugin, skill } = fixture(t);
  put(join(skill, "node_modules/@marp-team/marp-cli/marp-cli.js"), 'throw new Error("LOCAL DEPENDENCY USED");');
  const deck = join(directory, "deck.md");
  const diagram = join(directory, "flow.mmd");
  put(deck, "# Deck");
  put(diagram, "flowchart LR\naccTitle: Flow\naccDescr: A to B\nA --> B\n");
  for (const [name, script, args] of [
    [names[0], "render-review.mjs", ["--output", join(directory, "review"), deck]],
    [names[0], "check-overflow.mjs", [deck]],
    [names[1], "render-mermaid.mjs", [diagram]],
  ]) {
    const result = runScript(plugin, name, script, args, { PLAYWRIGHT_BROWSERS_PATH: join(directory, "browsers") });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Locked runtime missing.*setup-runtime\.mjs/);
    assert.doesNotMatch(result.stderr, /LOCAL DEPENDENCY USED/);
  }
  const info = runtimeInfo(skill);
  assert.equal(existsSync(info.directory), false);
  const path = runScript(plugin, names[0], "setup-runtime.mjs", ["--print-path"]);
  assert.equal(path.status, 0, path.stderr);
  assert.equal(path.stdout.trim(), info.directory);
  assert.equal(existsSync(info.directory), false);
});
