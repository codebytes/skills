import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function syncThumbnails(root = fileURLToPath(new URL("../../", import.meta.url))) {
  const images = join(root, "site", "public", "images");
  const sources = readdirSync(join(root, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, "skills", entry.name, "SKILL.md")))
    .map(({ name }) => ({
      source: join(root, "skills", name, "thumbnail.png"),
      name: `thumb-${name}.png`,
    }));
  for (const { source } of sources) {
    const stat = lstatSync(source);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Invalid thumbnail source: ${source}`);
  }
  mkdirSync(images, { recursive: true });
  if (lstatSync(images).isSymbolicLink()) throw new Error(`Refusing symlinked image directory: ${images}`);
  const existing = readdirSync(images, { withFileTypes: true })
    .filter(({ name }) => /^thumb-[a-z0-9-]+\.png$/.test(name));
  for (const entry of existing) {
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Invalid generated thumbnail: ${entry.name}`);
  }
  const names = new Set(sources.map(({ name }) => name));
  for (const { source, name } of sources) copyFileSync(source, join(images, name));
  for (const { name } of existing) {
    if (!names.has(name)) rmSync(join(images, name));
  }
  return sources.length;
}

if (import.meta.main) {
  try {
    if (process.argv.length > 2) throw new Error("This command accepts no arguments");
    console.log(`Generated ${syncThumbnails()} catalog thumbnails.`);
  } catch (error) {
    console.error(`Thumbnail sync failed: ${error.message}`);
    process.exitCode = 1;
  }
}
