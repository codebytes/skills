import {
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export function hashPlan(mutations) {
  const hash = createHash("sha256");
  for (const mutation of [...mutations].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(mutation.path);
    hash.update("\0");
    hash.update(mutation.expected ?? Buffer.from("create"));
    hash.update("\0");
    hash.update(mutation.bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

function ensureSafeDestination(root, path) {
  const absolute = resolve(path);
  const rel = relative(root, absolute);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || rel === "") {
    throw new Error(`Unsafe plan destination ${path}`);
  }

  let current = dirname(absolute);
  while (current !== root && current.startsWith(root)) {
    if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Plan destination has a symbolic link ancestor: ${path}`);
    }
    current = dirname(current);
  }
  if (lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(`Plan destination is a symbolic link: ${path}`);
  }
}

function matchesExpected(mutation) {
  if (mutation.expected === null) return !existsSync(mutation.path);
  return existsSync(mutation.path) && readFileSync(mutation.path).equals(mutation.expected);
}

function acquirePlanLock(root) {
  const lockPath = `${resolve(root)}.skills-repo.lock`;
  const owner = `${process.pid}.${randomBytes(16).toString("hex")}`;
  const candidate = `${lockPath}.${owner}.candidate`;
  writeFileSync(candidate, `${owner}\n`, { flag: "wx", mode: 0o600 });
  try {
    linkSync(candidate, lockPath);
  } catch (error) {
    if (error.code === "EEXIST") {
      const currentOwner = readFileSync(lockPath, "utf8").trim() || "unknown";
      throw new Error(
        `Another repository sync operation holds ${lockPath} for ${currentOwner}. Remove the lock only after confirming that operation has stopped.`,
      );
    }
    throw error;
  } finally {
    rmSync(candidate, { force: true });
  }
  return () => {
    const currentOwner = readFileSync(lockPath, "utf8").trim();
    if (currentOwner !== owner) {
      throw new Error(`Refusing to release repository sync lock owned by ${currentOwner || "unknown"}.`);
    }
    rmSync(lockPath);
  };
}

function applyPlanUnlocked(plan, options = {}) {
  if (options.dryRun) {
    return {
      applied: false,
      hash: plan.hash,
      changes: plan.mutations.map(({ path, action, bytes }) => ({
        path: relative(plan.root, path).split(sep).join("/"),
        action,
        bytes: bytes.length,
      })),
    };
  }
  if (!options.approval || options.approval !== plan.hash) {
    throw new Error(`Apply requires the single-use approval hash ${plan.hash}`);
  }
  for (const mutation of plan.mutations) ensureSafeDestination(plan.root, mutation.path);
  for (const mutation of plan.mutations) {
    if (!matchesExpected(mutation)) {
      throw new Error(`Plan source changed since preview: ${mutation.path}`);
    }
  }

  const token = `${process.pid}.${randomBytes(8).toString("hex")}`;
  const staged = [];
  const applied = [];
  const createdDirectories = new Set();
  try {
    for (const mutation of plan.mutations) {
      let parent = dirname(mutation.path);
      while (parent !== plan.root && !existsSync(parent)) {
        createdDirectories.add(parent);
        parent = dirname(parent);
      }
      mkdirSync(dirname(mutation.path), { recursive: true });
      const temporary = `${mutation.path}.${token}.tmp`;
      const existed = existsSync(mutation.path);
      const backup = existed ? `${mutation.path}.${token}.bak` : null;
      writeFileSync(temporary, mutation.bytes, { flag: "wx" });
      if (backup) copyFileSync(mutation.path, backup);
      staged.push({ ...mutation, temporary, backup, existed });
    }
    for (const item of staged) {
      if (!matchesExpected(item)) {
        throw new Error(`Plan source changed during apply: ${item.path}`);
      }
      renameSync(item.temporary, item.path);
      applied.push(item);
      if (options.afterWrite) options.afterWrite(item, applied.length);
    }
    for (const item of staged) {
      if (!readFileSync(item.path).equals(item.bytes)) {
        throw new Error(`Post-write verification failed for ${item.path}`);
      }
    }
  } catch (error) {
    const preserved = [];
    for (const item of [...applied].reverse()) {
      if (!existsSync(item.path) || !readFileSync(item.path).equals(item.bytes)) {
        preserved.push(item.path);
        continue;
      }
      if (item.backup && existsSync(item.backup)) {
        copyFileSync(item.backup, item.path);
      } else if (!item.existed) {
        rmSync(item.path, { force: true });
      }
    }
    for (const item of staged) {
      rmSync(item.temporary, { force: true });
      if (item.backup) rmSync(item.backup, { force: true });
    }
    for (const directory of [...createdDirectories].sort((a, b) => b.length - a.length)) {
      try {
        rmdirSync(directory);
      } catch {
      }
    }
    if (preserved.length > 0) {
      throw new Error(
        `Atomic apply failed. Rollback preserved external edits to: ${preserved.sort().join(", ")}. ${error.message}`,
        { cause: error },
      );
    }
    throw new Error(`Atomic apply failed and was rolled back: ${error.message}`);
  }

  const cleanupFailures = [];
  for (const item of staged) {
    if (!item.backup) continue;
    try {
      rmSync(item.backup, { force: true });
    } catch (error) {
      cleanupFailures.push(`${item.backup}: ${error.message}`);
    }
  }
  return {
    applied: true,
    hash: plan.hash,
    changes: plan.mutations.length,
    cleanupFailures,
  };
}

export function applyPlan(plan, options = {}) {
  if (options.dryRun || !options.approval || options.approval !== plan.hash) {
    return applyPlanUnlocked(plan, options);
  }
  const release = acquirePlanLock(plan.root);
  try {
    return applyPlanUnlocked(plan, options);
  } finally {
    release();
  }
}
