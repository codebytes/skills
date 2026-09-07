import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function skillNames() {
  return (await readdir(path.join(root, "skills"), { withFileTypes: true }))
    .filter((entry) =>
      entry.isDirectory() &&
      existsSync(path.join(root, "skills", entry.name, "SKILL.md")))
    .map((entry) => entry.name)
    .sort();
}

const read = (...parts) => readFile(path.join(root, ...parts), "utf8");

test("every canonical skill has deterministic Waza trigger coverage", async () => {
  for (const name of await skillNames()) {
    const evalPath = path.join(root, "evals", name, "eval.yaml");
    assert.ok(existsSync(evalPath), `Missing Waza eval for ${name}`);
    const source = await read("evals", name, "eval.yaml");
    assert.match(source, new RegExp(`^skill:\\s*${name}$`, "m"));
    assert.match(source, /^\s*executor:\s*mock\s*$/m);
    assert.match(source, /^\s*model:\s*mock-model\s*$/m);
    assert.match(source, /tasks\/\*\.yaml/);

    const taskDirectory = path.join(root, "evals", name, "tasks");
    const tasks = (await readdir(taskDirectory))
      .filter((file) => file.endsWith(".yaml"))
      .sort();
    assert.ok(tasks.length >= 3, `${name} needs at least three Waza trigger tasks`);

    const taskSources = await Promise.all(
      tasks.map((file) => read("evals", name, "tasks", file)),
    );
    assert.ok(
      taskSources.some((taskSource) => /mode:\s*positive/.test(taskSource)),
      `${name} has no positive trigger grader`,
    );
    assert.ok(
      taskSources.some((taskSource) => /mode:\s*negative/.test(taskSource)),
      `${name} has no negative trigger grader`,
    );
    for (const taskSource of taskSources) {
      assert.match(taskSource, /type:\s*trigger/);
      assert.match(taskSource, new RegExp(`skill_path:\\s*skills/${name}/SKILL\\.md`));
    }
  }
});
