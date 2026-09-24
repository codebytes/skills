import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootFiles = [
  "plugin.json", "marketplace.json", "gemini-extension.json",
  ".agents/plugins/marketplace.json", ".claude-plugin/plugin.json",
  ".claude-plugin/marketplace.json", ".codex-plugin/plugin.json",
  ".cursor-plugin/marketplace.json", "LICENSE", "THIRD-PARTY-NOTICES.md",
  ".skills-repo/LICENSE",
];
const skillFiles = ["SKILL.md", "README.md", "LICENSE", "thumbnail.png", "package.json", "package-lock.json"];
const runtimeExtensions = new Set([".mjs", ".js", ".py", ".md", ".json", ".svg", ".mmd", ".css", ".png"]);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function runtimeFiles(root) {
  const files = new Map();
  function add(relative) {
    const path = join(root, relative);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Runtime source must be a regular file: ${relative}`);
    files.set(relative, readFileSync(path));
  }
  function walk(relative) {
    if (lstatSync(join(root, relative)).isSymbolicLink()) throw new Error(`Symlinked runtime directory: ${relative}`);
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error(`Symlinked runtime source: ${relative}/${entry.name}`);
      if (["node_modules", "__pycache__"].includes(entry.name)) continue;
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (runtimeExtensions.has(extname(entry.name))) add(path);
    }
  }
  for (const file of rootFiles) add(file);
  const skills = readdirSync(join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, "skills", entry.name, "SKILL.md")))
    .map(({ name }) => name).sort();
  if (!skills.length) throw new Error("No canonical skills found");
  for (const name of skills) {
    const base = `skills/${name}`;
    for (const file of skillFiles) add(`${base}/${file}`);
    for (const directory of ["scripts", "references", "assets"]) {
      if (existsSync(join(root, base, directory))) walk(`${base}/${directory}`);
    }
    const pkg = JSON.parse(files.get(`${base}/package.json`));
    for (const command of ["test", "eval", "eval:lint"]) delete pkg.scripts?.[command];
    files.set(`${base}/package.json`, Buffer.from(json(pkg)));
  }
  const marketplace = JSON.parse(files.get("marketplace.json"));
  const registered = marketplace.plugins.filter(({ name }) => name !== marketplace.name).map(({ name }) => name).sort();
  if (JSON.stringify(registered) !== JSON.stringify(skills)) throw new Error("Marketplace is stale; run repository sync first");
  files.set("README.md", Buffer.from(`# ${JSON.parse(files.get("plugin.json")).name} runtime

This lean plugin contains skill instructions, runtime scripts, references,
assets, and locked rendering dependencies. Tests, evaluation tooling, and
catalog sources remain in the source repository. Browser binaries are not bundled.

For Copilot CLI, install this extracted directory with:

\`\`\`sh
copilot plugin install /absolute/path/to/plugin
\`\`\`

Use one installation method per client to avoid duplicate skills. To update,
obtain a newly built artifact and update/reinstall the local plugin using the
client's supported local-plugin workflow. Direct Git installs include the full
repository instead. See each skill's README for runtime prerequisites.
`));
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}

export function buildRuntime(root) {
  const output = join(root, "dist", "plugin");
  const stage = join(root, "dist", "plugin.staging");
  if (existsSync(output) || existsSync(stage)) throw new Error("dist/plugin or dist/plugin.staging already exists; move it aside before rebuilding");
  const files = runtimeFiles(root);
  mkdirSync(join(root, "dist"), { recursive: true });
  if (lstatSync(join(root, "dist")).isSymbolicLink()) throw new Error("Refusing symlinked dist directory");
  mkdirSync(stage);
  for (const [relative, bytes] of files) {
    const target = join(stage, relative);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes, { flag: "wx" });
  }
  renameSync(stage, output);
  return { output, files: files.size, bytes: [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0) };
}

if (import.meta.main) {
  try {
    if (process.argv.length > 2) throw new Error("Usage: node .skills-repo/package.mjs");
    console.log(json(buildRuntime(fileURLToPath(new URL("../", import.meta.url)))));
  } catch (error) {
    console.error(`Runtime packaging failed: ${error.message}`);
    process.exitCode = 1;
  }
}
