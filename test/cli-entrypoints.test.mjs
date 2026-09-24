import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const commands = [
  ".skills-repo/sync.mjs",
  "skills/drawio-diagrams/scripts/make-drawio-svg.mjs",
  "skills/drawio-diagrams/scripts/validate-drawio.mjs",
  "skills/marp-authoring/scripts/inspect-deck.mjs",
  "skills/marp-slide-review/scripts/check-overflow.mjs",
  "skills/marp-slide-review/scripts/render-review.mjs",
  "skills/marp-visuals/scripts/chart-to-svg.mjs",
  "skills/marp-visuals/scripts/render-mermaid.mjs",
];

test("portable CLI entry points run through directory aliases and stay inert on import", (t) => {
  const work = mkdtempSync(join(tmpdir(), "skills-entrypoints-"));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  const physical = join(work, "physical");
  const linked = join(work, "linked");
  mkdirSync(physical);
  for (const directory of new Set(commands.map(dirname))) {
    cpSync(join(root, directory), join(physical, directory), { recursive: true });
  }
  symlinkSync(physical, linked, process.platform === "win32" ? "junction" : "dir");

  for (const relative of commands) {
    for (const base of [physical, linked]) {
      const entry = join(base, relative);
      const help = spawnSync(process.execPath, [entry, "--help"], { encoding: "utf8", timeout: 10000 });
      assert.equal(help.status, 0, `${relative}: ${help.stderr}`);
      assert.match(help.stdout, /Usage:/, `${relative}: help was not executed`);
    }
    const imported = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(pathToFileURL(join(linked, relative)).href)})`],
      { encoding: "utf8", timeout: 10000 },
    );
    assert.equal(imported.status, 0, `${relative}: ${imported.stderr}`);
    assert.equal(imported.stdout, "", `${relative}: import executed the CLI`);
  }
});
