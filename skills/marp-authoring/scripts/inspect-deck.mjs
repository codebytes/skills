#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const HELP = `Inspect a Marp deck without modifying it.

Usage:
  node scripts/inspect-deck.mjs [--json] <deck.md>

Reports slide titles, classes, word counts, bullets, images, notes, Mermaid
content, and density warnings.`;

function cleanInline(value) {
  return value
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitFrontmatter(source) {
  const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return { frontmatter: "", body: lines };

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) throw new Error("Deck frontmatter starts with --- but has no closing delimiter.");
  return {
    frontmatter: lines.slice(1, end).join("\n"),
    body: lines.slice(end + 1),
  };
}

function scanLines(lines) {
  const result = [];
  let fence = null;
  let comment = false;
  for (const line of lines) {
    if (fence) {
      const closes = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`).test(line);
      result.push({ raw: line, text: closes ? "" : line, code: true, separator: false });
      if (closes) fence = null;
      continue;
    }
    const insideComment = comment;
    let text = "";
    let offset = 0;
    while (offset < line.length) {
      const marker = line.indexOf(comment ? "-->" : "<!--", offset);
      if (marker < 0) {
        if (!comment) text += line.slice(offset);
        break;
      }
      if (!comment) text += line.slice(offset, marker);
      offset = marker + (comment ? 3 : 4);
      comment = !comment;
    }
    const marker = text.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (marker && !(marker[1][0] === "`" && marker[2].includes("`"))) fence = marker[1];
    result.push({
      raw: line,
      text: fence ? "" : text,
      code: Boolean(fence),
      separator: !insideComment && !comment && !fence && line.trim() === "---",
    });
  }
  return result;
}

function splitSlides(lines) {
  const slides = [];
  let current = [];
  for (const line of scanLines(lines)) {
    if (line.separator) {
      slides.push(current.join("\n").trim());
      current = [];
    } else {
      current.push(line.raw);
    }
  }
  slides.push(current.join("\n").trim());
  return slides;
}

function visibleText(source) {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countNotes(source) {
  return [...source.matchAll(/<!--([\s\S]*?)-->/g)]
    .map((match) => match[1].trim())
    .filter((comment) => comment && !comment.startsWith("_"))
    .filter((comment) => !/^(?:marp|theme|paginate|size|header|footer|class|color|background|transition):/i.test(comment))
    .length;
}

function analyzeSlide(source, index) {
  const lines = scanLines(source.split("\n"));
  const structure = lines.filter((line) => !line.code).map((line) => line.text).join("\n");
  const outsideCode = lines.filter((line) => !line.code).map((line) => line.raw).join("\n");
  const heading = structure.match(/^\s{0,3}#{1,6}\s+(.+)$/m)?.[1]
    ?? structure.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    ?? "";
  const classes = [...outsideCode.matchAll(/<!--\s*_class:\s*([^>]+?)\s*-->/g)]
    .flatMap((match) => match[1].trim().split(/\s+/))
    .filter(Boolean);
  const markdownImages = [...structure.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  const htmlImages = [...structure.matchAll(/<img\b[^>]*>/gi)];
  const text = [
    visibleText(structure),
    lines.filter((line) => line.code).map((line) => line.text).join("\n"),
  ].join(" ").replace(/\s+/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  const bullets = [...structure.matchAll(/^\s*(?:[-+*]|\d+\.)\s+\S/gm)].length;
  const mermaid = [...structure.matchAll(/class=["'][^"']*\bmermaid\b/gi)].length +
    lines.filter((line) => line.code && /^ {0,3}(?:`{3,}|~{3,})mermaid\b/i.test(line.raw)).length;
  const warnings = [];

  if (!text && markdownImages.length + htmlImages.length === 0) warnings.push("empty slide");
  if (words > 90) warnings.push("dense text");
  if (bullets > 6) warnings.push("many bullets");
  if (markdownImages.some((match) => match[1].trim() === "")) warnings.push("missing image alt text");
  if (mermaid > 0) warnings.push("runtime Mermaid");

  return {
    slide: index + 1,
    title: cleanInline(heading) || "(untitled)",
    classes: [...new Set(classes)],
    words,
    bullets,
    images: markdownImages.length + htmlImages.length,
    notes: countNotes(outsideCode),
    mermaid,
    warnings,
  };
}

export function inspectDeck(source) {
  const { frontmatter, body } = splitFrontmatter(source);
  const rawSlides = splitSlides(body);
  const slides = rawSlides.map(analyzeSlide);
  return {
    frontmatter,
    slides,
    summary: {
      slides: slides.length,
      words: slides.reduce((sum, slide) => sum + slide.words, 0),
      images: slides.reduce((sum, slide) => sum + slide.images, 0),
      notes: slides.reduce((sum, slide) => sum + slide.notes, 0),
      warnings: slides.reduce((sum, slide) => sum + slide.warnings.length, 0),
    },
  };
}

function printReport(deck, report) {
  console.log(`Deck: ${deck}`);
  console.log(
    `Slides: ${report.summary.slides} | Words: ${report.summary.words} | ` +
    `Images: ${report.summary.images} | Notes: ${report.summary.notes} | ` +
    `Warnings: ${report.summary.warnings}`,
  );
  console.log("");
  console.log("Slide  Words  Bullets  Images  Notes  Classes  Title / warnings");
  for (const slide of report.slides) {
    const suffix = slide.warnings.length ? ` [${slide.warnings.join(", ")}]` : "";
    console.log(
      `${String(slide.slide).padEnd(6)}` +
      `${String(slide.words).padEnd(7)}` +
      `${String(slide.bullets).padEnd(9)}` +
      `${String(slide.images).padEnd(8)}` +
      `${String(slide.notes).padEnd(7)}` +
      `${(slide.classes.join(",") || "-").padEnd(9)}` +
      `${slide.title}${suffix}`,
    );
  }
}

function main(argv) {
  const json = argv.includes("--json");
  const positional = argv.filter((arg) => arg !== "--json");
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }
  const unknown = positional.find((arg) => arg.startsWith("-"));
  if (unknown) throw new Error(`Unknown option: ${unknown}`);
  if (positional.length !== 1) {
    console.error(HELP);
    return 2;
  }

  const deck = resolve(positional[0]);
  const report = inspectDeck(readFileSync(deck, "utf8"));
  if (json) console.log(JSON.stringify({ deck, ...report }, null, 2));
  else printReport(deck, report);
  return 0;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`inspect-deck: ${error.message}`);
    process.exitCode = 2;
  }
}
