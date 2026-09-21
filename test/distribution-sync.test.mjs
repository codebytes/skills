import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildSyncPlan, run } from "../.skills-repo/sync.mjs";
import { applyPlan } from "../skills/create-skill/scripts/registration.mjs";
import { createRepositoryFixture, write } from "../skills/create-skill/test/helpers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const marketplacePath = ".agents/plugins/marketplace.json";
const statePath = ".skills-repo/state.json";
const hash = (text) => createHash("sha256").update(text.replace(/\r\n?/g, "\n")).digest("hex");
const read = (directory, file) => readFileSync(join(directory, file), "utf8");

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "skills-distribution-sync-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  createRepositoryFixture(directory, { managed: true });
  writeFileSync(join(directory, "README.md"), `${read(directory, "README.md")}
## Install

Old installation instructions.

## Validation

Old validation instructions.

## Catalog

Keep this catalog section.
`);
  write(join(directory, marketplacePath), JSON.stringify({
    name: "octocat-skills",
    plugins: [{ name: "octocat-skills", source: { source: "local", path: "./" } }],
  }));
  const state = JSON.parse(read(directory, statePath));
  for (const file of ["README.md", marketplacePath]) {
    state.files[file] = { sha256: hash(read(directory, file)), normalization: "lf" };
  }
  writeFileSync(join(directory, statePath), `${JSON.stringify(state, null, 2)}\n`);
  return directory;
}

test("checked-in distribution views match their authored sources", () => {
  assert.equal(buildSyncPlan(root).mutations.length, 0);
});

test("sync previews the supported local-root plugin without changing files", (t) => {
  const directory = fixture(t);
  const before = read(directory, marketplacePath);
  const plan = buildSyncPlan(directory);
  const preview = applyPlan(plan, { dryRun: true });
  assert.equal(preview.applied, false);
  assert.deepEqual(preview.changes.map((change) => change.path), [
    marketplacePath, "README.md", statePath,
  ]);
  const marketplace = JSON.parse(plan.mutations[0].bytes);
  assert.deepEqual(marketplace.plugins[0].source, {
    source: "local",
    path: "./",
  });
  assert.equal(read(directory, marketplacePath), before);
  assert.equal(buildSyncPlan(directory).hash, plan.hash);
});

test("approved sync is idempotent and preserves the table and unrelated managed records", (t) => {
  const directory = fixture(t);
  const previousReadme = read(directory, "README.md");
  const previousState = JSON.parse(read(directory, statePath));
  const plan = buildSyncPlan(directory);
  applyPlan(plan, { approval: plan.hash });
  const readme = read(directory, "README.md");
  assert.equal(readme.split("\n## Install\n")[0], previousReadme.split("\n## Install\n")[0]);
  assert.equal(readme.split("\n## Catalog\n")[1], previousReadme.split("\n## Catalog\n")[1]);
  assert.match(readme, /skills\/create-skill\/evals\/create-skill\/eval\.yaml/);
  assert.match(readme, /gh workflow run skill-eval.yml --repo octocat\/skills --ref main/);
  assert.match(readme, /copilot plugin update octocat-skills@octocat-skills/);
  assert.match(readme, /codex plugin marketplace upgrade octocat-skills/);
  assert.doesNotMatch(readme, /\{\{[^}]+\}\}/);
  const state = JSON.parse(read(directory, statePath));
  for (const [file, record] of Object.entries(state.files)) {
    assert.equal(record.sha256, hash(read(directory, file)), file);
    if (!["README.md", marketplacePath].includes(file)) {
      assert.deepEqual(record, previousState.files[file]);
    }
  }
  assert.equal(buildSyncPlan(directory).mutations.length, 0);
});

test("sync refuses drift rather than blessing a hand-edited managed manifest", (t) => {
  const directory = fixture(t);
  writeFileSync(join(directory, marketplacePath), '{"unexpected":"user edit"}\n');
  assert.throws(() => buildSyncPlan(directory), /changed outside sync/);
});

test("sync refuses symlinked managed files", (t) => {
  const directory = fixture(t);
  rmSync(join(directory, marketplacePath));
  symlinkSync(join(directory, "plugin.json"), join(directory, marketplacePath));
  assert.throws(() => buildSyncPlan(directory), /symlinked managed path/);
});

test("approval becomes stale after concurrent changes", (t) => {
  const directory = fixture(t);
  const plan = buildSyncPlan(directory);
  const marketplace = read(directory, marketplacePath);
  writeFileSync(join(directory, "README.md"), "# Concurrent user edit\n");
  assert.throws(() => applyPlan(plan, { approval: plan.hash }), /source changed since preview/);
  assert.equal(read(directory, marketplacePath), marketplace);
});

test("CLI check is read-only and malformed approval arguments fail", (t) => {
  const directory = fixture(t);
  const output = { write() {} };
  assert.equal(run(["--check"], { cwd: directory, output }), 1);
  assert.throws(() => run(["--approve"], { cwd: directory, output }), /preview hash/);
  assert.throws(() => run(["--approve", "0".repeat(64)], { cwd: directory, output }), /single-use approval/);
  assert.equal(JSON.parse(read(directory, marketplacePath)).plugins[0].source.source, "local");
});

test("sync derives the marketplace identity from managed configuration", (t) => {
  const directory = fixture(t);
  const config = JSON.parse(read(directory, "skills-repo.config.json"));
  config.package.name = "octocat-packs";
  config.package.displayName = "Octocat Packs";
  writeFileSync(join(directory, "skills-repo.config.json"), JSON.stringify(config));
  const marketplace = JSON.parse(buildSyncPlan(directory).mutations[0].bytes);
  assert.equal(marketplace.name, "octocat-packs");
  assert.equal(marketplace.plugins[0].name, "octocat-packs");
  assert.equal(marketplace.interface.displayName, "Octocat Packs");
});
