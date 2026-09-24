import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyPlan, hashPlan } from "../.skills-repo/lib/atomic-plan.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "skills-repo-plan-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "existing.txt"), "original");
  const mutations = [
    { path: join(root, "existing.txt"), action: "update", expected: Buffer.from("original"), bytes: Buffer.from("updated") },
    { path: join(root, "new.txt"), action: "create", expected: null, bytes: Buffer.from("created") },
  ];
  return { root, mutations, hash: hashPlan(mutations) };
}

test("atomic plans require matching approval and reject replay", (t) => {
  const plan = fixture(t);
  assert.equal(hashPlan([...plan.mutations].reverse()), plan.hash);
  assert.equal(applyPlan(plan, { dryRun: true }).applied, false);
  assert.throws(() => applyPlan(plan), /single-use approval/);
  assert.equal(readFileSync(plan.mutations[0].path, "utf8"), "original");
  assert.equal(applyPlan(plan, { approval: plan.hash }).applied, true);
  assert.equal(readFileSync(plan.mutations[1].path, "utf8"), "created");
  assert.throws(() => applyPlan(plan, { approval: plan.hash }), /source changed since preview/);
  assert.equal(existsSync(`${plan.root}.skills-repo.lock`), false);
});

test("atomic plans roll back a partial write without leaving temporary files", (t) => {
  const plan = fixture(t);
  assert.throws(() => applyPlan(plan, {
    approval: plan.hash,
    afterWrite() { throw new Error("injected failure"); },
  }), /rolled back.*injected failure/);
  assert.equal(readFileSync(plan.mutations[0].path, "utf8"), "original");
  assert.deepEqual(readdirSync(plan.root), ["existing.txt"]);
});

test("rollback preserves concurrent edits", (t) => {
  const plan = fixture(t);
  assert.throws(() => applyPlan(plan, {
    approval: plan.hash,
    afterWrite(item) {
      writeFileSync(item.path, "external edit");
      throw new Error("injected failure");
    },
  }), /Rollback preserved external edits/);
  assert.equal(readFileSync(plan.mutations[0].path, "utf8"), "external edit");
  assert.deepEqual(readdirSync(plan.root), ["existing.txt"]);
});

test("atomic plans refuse concurrent writers and paths outside the repository", (t) => {
  const plan = fixture(t);
  const lock = `${plan.root}.skills-repo.lock`;
  t.after(() => rmSync(lock, { force: true }));
  writeFileSync(lock, "another writer");
  assert.throws(() => applyPlan(plan, { approval: plan.hash }), /Another repository sync operation holds/);
  assert.equal(readFileSync(lock, "utf8"), "another writer");
  rmSync(lock);
  plan.mutations[0].path = join(plan.root, "..", "outside.txt");
  plan.hash = hashPlan(plan.mutations);
  assert.throws(() => applyPlan(plan, { approval: plan.hash }), /Unsafe plan destination/);
  assert.equal(existsSync(lock), false);
});
