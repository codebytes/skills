import assert from "node:assert/strict";
import { access, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (relative) =>
  JSON.parse(await readFile(path.join(root, relative), "utf8"));
const pluginSchema = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";

async function packagePath(relative) {
  assert.equal(typeof relative, "string");
  assert.ok(relative.startsWith("./"), `Not plugin-relative: ${relative}`);
  const resolved = await realpath(path.resolve(root, relative));
  const inside = path.relative(await realpath(root), resolved);
  assert.ok(
    inside !== ".." && !inside.startsWith(`..${path.sep}`) && !path.isAbsolute(inside),
    `Path escapes the plugin package: ${relative}`,
  );
  return resolved;
}

async function skillDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  for (const entry of directories) {
    await access(path.join(directory, entry.name, "SKILL.md"));
  }
  return directories.map((entry) => entry.name).sort();
}

test("the portable manifest follows the closed Agent Plugins 1.0 contract", async () => {
  const plugin = await readJson("plugin.json");
  const allowed = new Set([
    "$schema", "name", "version", "description", "author", "homepage",
    "repository", "license", "keywords", "extensions",
  ]);
  assert.equal(plugin.$schema, pluginSchema);
  assert.match(plugin.name, /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
  assert.ok(plugin.name.length <= 64);
  for (const key of Object.keys(plugin)) {
    assert.ok(allowed.has(key), `Nonportable root plugin field: ${key}`);
  }
  for (const key of ["version", "description", "homepage", "repository", "license"]) {
    if (Object.hasOwn(plugin, key)) assert.equal(typeof plugin[key], "string", key);
  }
  if (Object.hasOwn(plugin, "author")) {
    assert.ok(plugin.author && typeof plugin.author === "object");
    assert.equal(Array.isArray(plugin.author), false);
    for (const [key, value] of Object.entries(plugin.author)) {
      assert.ok(["name", "email", "url"].includes(key), `Unknown author field: ${key}`);
      assert.equal(typeof value, "string");
    }
  }
  if (Object.hasOwn(plugin, "keywords")) {
    assert.ok(Array.isArray(plugin.keywords));
    for (const keyword of plugin.keywords) assert.equal(typeof keyword, "string");
  }
  if (Object.hasOwn(plugin, "extensions")) {
    assert.ok(plugin.extensions && typeof plugin.extensions === "object");
    assert.equal(Array.isArray(plugin.extensions), false);
    for (const extension of Object.values(plugin.extensions)) {
      assert.ok(extension && typeof extension === "object");
      assert.equal(Array.isArray(extension), false);
    }
  }
});

test("portable and native plugins discover the same canonical skill collection", async () => {
  const config = await readJson("skills-repo.config.json");
  const canonical = await packagePath("./skills");
  const skills = await skillDirectories(canonical);
  assert.ok(skills.length > 0);

  for (const file of ["plugin.json", ".claude-plugin/plugin.json", ".codex-plugin/plugin.json"]) {
    const plugin = await readJson(file);
    assert.equal(plugin.name, config.package.name, file);
    assert.equal(plugin.version, config.package.version, file);
    assert.equal(plugin.description, config.package.description, file);
    const directory = await packagePath(plugin.skills ?? "./skills");
    assert.equal(directory, canonical, file);
    assert.deepEqual(await skillDirectories(directory), skills, file);
  }

  for (const name of skills) {
    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(name.length <= 64);
    await packagePath(`./skills/${name}/SKILL.md`);
  }
});

test("individual Copilot and VS Code entries retain skill-only compatibility", async () => {
  const marketplace = await readJson("marketplace.json");
  const aggregate = await readJson("plugin.json");
  for (const entry of marketplace.plugins.filter((item) => item.name !== aggregate.name)) {
    const directory = await packagePath(entry.source);
    assert.equal(directory, await packagePath(`./skills/${entry.name}`));
    await access(path.join(directory, "SKILL.md"));
    assert.equal(
      (await readdir(directory)).includes("plugin.json"),
      false,
      `${entry.name}: a standard manifest would disable root SKILL.md discovery`,
    );
  }
});

test("Claude marketplace resolves the aggregate from the repository root", async () => {
  const marketplace = await readJson(".claude-plugin/marketplace.json");
  const plugin = await readJson(".claude-plugin/plugin.json");
  assert.equal(typeof marketplace.owner.name, "string");
  assert.ok(marketplace.owner.name.trim());
  const aggregate = marketplace.plugins.find((entry) => entry.name === plugin.name);
  assert.ok(aggregate, "The native Claude marketplace must advertise the collection");
  assert.equal(await packagePath(aggregate.source), await realpath(root));
  assert.equal(aggregate.version, plugin.version);
  assert.notEqual(
    aggregate.strict,
    false,
    "strict:false conflicts with the native plugin's component declarations",
  );
});

test("Gemini uses its native manifest and implicit root skills directory", async () => {
  const config = await readJson("skills-repo.config.json");
  const extension = await readJson("gemini-extension.json");
  assert.equal(extension.name, config.package.name);
  assert.equal(extension.version, config.package.version);
  assert.match(extension.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal(
    Object.hasOwn(extension, "skills"),
    false,
    "Gemini discovers skills/; a copied Claude skills field has no effect",
  );
  assert.ok((await skillDirectories(await packagePath("./skills"))).length > 0);
});
