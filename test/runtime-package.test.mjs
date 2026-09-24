import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildRuntime, runtimeFiles } from "../.skills-repo/package.mjs";
import { syncThumbnails } from "../site/scripts/sync-thumbnails.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const json = (path) => JSON.parse(readFileSync(path, "utf8"));

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "skills-runtime-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("runtime artifact retains all skills and executable sources without development tooling", (t) => {
  const directory = fixture(t);
  const files = runtimeFiles(root);
  for (const [relative, bytes] of files) {
    assert.doesNotMatch(relative, /^(?:site|test|evals|\.github)\//);
    assert.doesNotMatch(relative, /^skills\/[^/]+\/(?:test|evals|node_modules)\//);
    const target = join(directory, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    if (/^skills\/.+\/(?:scripts|references|assets)\//.test(relative)) {
      assert.deepEqual(bytes, readFileSync(join(root, relative)));
    }
  }
  const result = buildRuntime(directory);
  assert.ok(result.bytes < 600_000, `Runtime artifact exceeds 600 KB: ${result.bytes}`);
  assert.equal(result.files, files.size);
  assert.deepEqual([...runtimeFiles(directory)], [...files]);
  assert.throws(() => buildRuntime(directory), /already exists/);
  const marketplace = json(join(result.output, "marketplace.json"));
  for (const { source } of marketplace.plugins) assert.ok(existsSync(join(result.output, source)));
  for (const relative of files.keys()) {
    if (!/^skills\/[^/]+\/package.json$/.test(relative)) continue;
    const pkg = json(join(result.output, relative));
    assert.ok(!pkg.scripts.test && !pkg.scripts.eval && !pkg.scripts["eval:lint"]);
    const lock = json(join(result.output, dirname(relative), "package-lock.json"));
    assert.deepEqual(pkg.devDependencies, lock.packages[""].devDependencies);
  }
  const help = spawnSync(process.execPath, [
    join(result.output, "skills", "marp-authoring", "scripts", "inspect-deck.mjs"), "--help",
  ], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);
});

test("catalog thumbnails are generated exactly and stale generated copies are pruned", (t) => {
  const directory = fixture(t);
  cpSync(join(root, "skills", "marp-authoring"), join(directory, "skills", "marp-authoring"), {
    recursive: true, filter: (source) => !source.includes("node_modules"),
  });
  const images = join(directory, "site", "public", "images");
  mkdirSync(images, { recursive: true });
  writeFileSync(join(images, "thumb-retired.png"), "stale");
  writeFileSync(join(images, "og.svg"), "<svg/>");
  assert.equal(syncThumbnails(directory), 1);
  assert.deepEqual(readFileSync(join(images, "thumb-marp-authoring.png")),
    readFileSync(join(directory, "skills", "marp-authoring", "thumbnail.png")));
  assert.equal(existsSync(join(images, "thumb-retired.png")), false);
  assert.equal(readFileSync(join(images, "og.svg"), "utf8"), "<svg/>");
  assert.equal(syncThumbnails(directory), 1);
});

test("runtime packaging rejects stale registration and excludes incidental files", (t) => {
  const directory = fixture(t);
  for (const [relative, bytes] of runtimeFiles(root)) {
    const target = join(directory, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  const scripts = join(directory, "skills", "marp-authoring", "scripts");
  writeFileSync(join(scripts, ".env"), "PRIVATE_SETTING=not-for-distribution");
  mkdirSync(join(scripts, "__pycache__"));
  writeFileSync(join(scripts, "__pycache__", "example.pyc"), "cache");
  const files = runtimeFiles(directory);
  assert.ok(![...files.keys()].some((path) => path.endsWith(".env") || path.endsWith(".pyc")));
  const marketplace = json(join(directory, "marketplace.json"));
  marketplace.plugins.pop();
  writeFileSync(join(directory, "marketplace.json"), JSON.stringify(marketplace));
  assert.throws(() => buildRuntime(directory), /Marketplace is stale/);
  assert.equal(existsSync(join(directory, "dist")), false);
});
