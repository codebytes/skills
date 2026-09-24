import assert from "node:assert/strict";
import test from "node:test";
import { readSkillDescription } from "../.skills-repo/lib/skill-description.mjs";

test("skill descriptions support scalar and multiline YAML styles", () => {
  for (const value of [
    "Plain description",
    '"Plain description"',
    "'Plain description'",
    ">-\n  Plain\n  description",
    "|\n  Plain\n  description",
  ]) {
    assert.equal(readSkillDescription(`---\nname: example\ndescription: ${value}\n---\n`), "Plain description");
  }
  assert.equal(readSkillDescription("description: 'A skill''s description'\n"), "A skill's description");
  assert.throws(() => readSkillDescription("---\nname: example\n---\n"), /Cannot read skill description/);
});
