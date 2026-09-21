import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlan, hashPlan } from "../skills/create-skill/scripts/registration.mjs";
import { validateManagedConfig } from "../skills/create-skill/scripts/repository.mjs";

const marketplacePath = ".agents/plugins/marketplace.json";
const statePath = ".skills-repo/state.json";
const templatePath = fileURLToPath(new URL("./templates/install.md", import.meta.url));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

function readManaged(root, relative) {
  let current = root;
  for (const part of relative.split("/")) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing symlinked managed path: ${relative}`);
    }
  }
  if (!lstatSync(current).isFile()) {
    throw new Error(`Managed path is not a regular file: ${relative}`);
  }
  return readFileSync(current);
}

function digest(bytes, normalization) {
  if (!["lf", "raw"].includes(normalization)) {
    throw new Error(`Unsupported managed normalization: ${normalization}`);
  }
  const content = normalization === "lf"
    ? bytes.toString("utf8").replace(/\r\n?/g, "\n")
    : bytes;
  return createHash("sha256").update(content).digest("hex");
}

function renderReadme(readme, config) {
  const start = "\n## Install\n";
  const end = "\n## Catalog\n";
  if (readme.split(start).length !== 2 || readme.split(end).length !== 2) {
    throw new Error("README must have exactly one Install and one Catalog heading");
  }
  const startIndex = readme.indexOf(start);
  const endIndex = readme.indexOf(end);
  if (endIndex <= startIndex) throw new Error("README installation section is out of order");
  let template = readFileSync(templatePath, "utf8");
  for (const [key, value] of Object.entries({
    repository: `${config.owner.login}/${config.repository.name}`,
    repositoryUrl: config.repository.url,
    packageName: config.package.name,
    defaultBranch: config.github.defaultBranch,
  })) {
    template = template.replaceAll(`{{${key}}}`, value);
  }
  if (/\{\{[^}]+\}\}/.test(template)) throw new Error("Unknown installation template placeholder");
  return `${readme.slice(0, startIndex)}\n${template.trimEnd()}\n${readme.slice(endIndex)}`;
}

export function buildSyncPlan(directory) {
  const root = realpathSync(resolve(directory));
  const config = JSON.parse(readManaged(root, "skills-repo.config.json"));
  validateManagedConfig(config, root);
  const previousState = readManaged(root, statePath);
  const state = JSON.parse(previousState);
  if (
    state.schemaVersion !== 1 || state.hashVersion !== 1 ||
    state.templateVersion !== config.templateVersion ||
    !state.files || typeof state.files !== "object" || Array.isArray(state.files)
  ) {
    throw new Error("Unsupported managed repository state");
  }

  const current = new Map();
  for (const relative of [marketplacePath, "README.md"]) {
    const bytes = readManaged(root, relative);
    const record = state.files[relative];
    if (!record || !/^[a-f0-9]{64}$/.test(record.sha256 ?? "")) {
      throw new Error(`Missing or invalid managed record: ${relative}`);
    }
    if (digest(bytes, record.normalization) !== record.sha256) {
      throw new Error(`Managed file changed outside sync; preserve and reconcile it first: ${relative}`);
    }
    current.set(relative, bytes);
  }

  const marketplace = {
    name: config.package.name,
    interface: { displayName: config.package.displayName },
    plugins: [{
      name: config.package.name,
      source: {
        source: "local",
        path: "./",
      },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: "Developer Tools",
    }],
  };
  const desired = new Map([
    [marketplacePath, json(marketplace)],
    ["README.md", renderReadme(current.get("README.md").toString("utf8").replace(/\r\n?/g, "\n"), config)],
  ]);
  const mutations = [];
  for (const [relative, value] of desired) {
    const bytes = Buffer.from(value);
    if (bytes.equals(current.get(relative))) continue;
    mutations.push({
      path: join(root, relative),
      action: "update",
      expected: current.get(relative),
      bytes,
    });
    state.files[relative].sha256 = digest(bytes, state.files[relative].normalization);
  }
  if (mutations.length > 0) {
    mutations.push({
      path: join(root, statePath),
      action: "update",
      expected: previousState,
      bytes: Buffer.from(json(state)),
    });
  }
  return { root, mutations, hash: hashPlan(mutations) };
}

export function run(argv, { cwd = process.cwd(), output = process.stdout } = {}) {
  if (argv.length === 1 && argv[0] === "--help") {
    output.write("Usage: node .skills-repo/sync.mjs [--dry-run | --check | --approve HASH]\n");
    return 0;
  }
  const mode = argv[0] ?? "--dry-run";
  if (
    !["--dry-run", "--check", "--approve"].includes(mode) ||
    (mode === "--approve"
      ? argv.length !== 2 || !/^[a-f0-9]{64}$/.test(argv[1])
      : argv.length > 1)
  ) {
    throw new Error("Use --dry-run, --check, or --approve followed by the preview hash");
  }
  const plan = buildSyncPlan(cwd);
  const result = applyPlan(
    plan,
    mode === "--approve" ? { approval: argv[1] } : { dryRun: true },
  );
  output.write(json(result));
  return mode === "--check" && plan.mutations.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (error) {
    console.error(`Distribution sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}
