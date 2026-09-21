#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeXml, extract } from "./make-drawio-svg.mjs";

const HELP = `Validate a native .drawio file or editable .drawio.svg.

Usage:
  node scripts/validate-drawio.mjs [--json] <diagram.drawio|diagram.drawio.svg>

Exit codes:
  0  Structurally valid (warnings may be present)
  1  Validation errors
  2  Usage or read error`;

function parseAttributes(source) {
  const attributes = Object.create(null);
  const pattern = /^\s+([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/;
  let remaining = source;
  while (remaining.trim()) {
    const match = remaining.match(pattern);
    if (!match) throw new Error("Malformed XML attribute.");
    if (Object.hasOwn(attributes, match[1])) throw new Error(`Duplicate XML attribute ${match[1]}.`);
    attributes[match[1]] = decodeXml(match[2] ?? match[3]);
    remaining = remaining.slice(match[0].length);
  }
  return attributes;
}

export function parseXml(source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(source) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source)) {
    throw new Error("Unsupported XML declaration or control character.");
  }
  const tokens = source.matchAll(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?(?:[^"'<>]|"[^"]*"|'[^']*')+>/g);
  const stack = [];
  let documentRoot = null;
  let offset = 0;
  function appendText(text, cdata = false) {
    if (!cdata && text.includes("<")) throw new Error("Malformed XML markup.");
    if (!stack.length && text.trim()) throw new Error("Text outside the XML root.");
    if (stack.length) stack.at(-1).text += cdata ? text : decodeXml(text);
  }

  for (const match of tokens) {
    appendText(source.slice(offset, match.index));
    const token = match[0];
    offset = match.index + token.length;
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      appendText(token.slice(9, -3), true);
      continue;
    }
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      const current = stack.pop();
      if (!current || current.name !== name) {
        throw new Error(`Mismatched closing tag </${name}>.`);
      }
      continue;
    }

    const selfClosing = /\/\s*>$/.test(token);
    const body = token.slice(1, selfClosing ? token.lastIndexOf("/") : -1).trim();
    const name = body.match(/^([A-Za-z_:][A-Za-z0-9_.:-]*)/)?.[1];
    if (!name) throw new Error(`Cannot parse XML tag: ${token.slice(0, 80)}`);
    const node = {
      name,
      attributes: parseAttributes(body.slice(name.length)),
      children: [],
      text: "",
    };
    if (stack.length) stack.at(-1).children.push(node);
    else if (documentRoot === null) documentRoot = node;
    else throw new Error("XML contains more than one root element.");
    if (!selfClosing) stack.push(node);
  }

  appendText(source.slice(offset));
  if (stack.length) throw new Error(`Unclosed XML tag <${stack.at(-1).name}>.`);
  if (!documentRoot) throw new Error("XML has no root element.");
  return documentRoot;
}

function children(node, name) {
  return node.children.filter((child) => child.name === name);
}

function child(node, name) {
  return children(node, name)[0] ?? null;
}

function finiteAttribute(node, name) {
  const value = Number(node.attributes[name]);
  return Number.isFinite(value) ? value : null;
}

function validateMxfile(xml, result, { accessibleTitle = false } = {}) {
  let root;
  try {
    root = parseXml(xml);
  } catch (error) {
    result.errors.push(`XML parse error: ${error.message}`);
    return;
  }

  if (root.name !== "mxfile") {
    result.errors.push(`Root element must be <mxfile>, got <${root.name}>.`);
    return;
  }
  const diagrams = children(root, "diagram");
  if (diagrams.length === 0) {
    result.errors.push("No <diagram> elements found inside <mxfile>.");
    return;
  }
  result.stats.pages = diagrams.length;

  diagrams.forEach((diagram, pageIndex) => {
    const page = diagram.attributes.name || `page-${pageIndex + 1}`;
    const prefix = `[diagram "${page}"]`;
    if (!diagram.attributes.id) result.warnings.push(`${prefix} Diagram has no id attribute.`);
    if (!diagram.attributes.name) result.errors.push(`${prefix} Diagram has no name attribute.`);

    const model = child(diagram, "mxGraphModel");
    if (!model) {
      if (diagram.children.length === 0 && /^[A-Za-z0-9+/=\s]+$/.test(diagram.text.trim())) {
        result.warnings.push(`${prefix} Compressed diagram content was not structurally inspected.`);
      } else {
        result.errors.push(`${prefix} Missing <mxGraphModel> or compressed diagram content.`);
      }
      return;
    }
    const modelRoot = child(model, "root");
    if (!modelRoot) {
      result.errors.push(`${prefix} Missing <root> inside <mxGraphModel>.`);
      return;
    }

    const cells = children(modelRoot, "mxCell");
    const byId = new Map();
    for (const cell of cells) {
      const id = cell.attributes.id;
      if (!id) {
        result.errors.push(`${prefix} Found <mxCell> without an id.`);
        continue;
      }
      if (byId.has(id)) result.errors.push(`${prefix} Duplicate cell id="${id}".`);
      byId.set(id, cell);
    }
    result.stats.cells += cells.length;

    if (cells[0]?.attributes.id !== "0") {
      result.errors.push(`${prefix} First <mxCell> must have id="0".`);
    }
    if (cells[1]?.attributes.id !== "1") {
      result.errors.push(`${prefix} Second <mxCell> must have id="1".`);
    }
    if (byId.get("1")?.attributes.parent !== "0") {
      result.errors.push(`${prefix} Cell id="1" must have parent="0".`);
    }

    const hasTitleCell = cells.some((cell) => {
      const style = cell.attributes.style ?? "";
      return cell.attributes.vertex === "1" &&
        (style.startsWith("text;") || style.includes(";text;")) &&
        style.includes("fontSize=18");
    });
    if (!hasTitleCell && !accessibleTitle) {
      result.warnings.push(`${prefix} No visible title cell with text and fontSize=18.`);
    }

    for (const cell of cells) {
      const id = cell.attributes.id ?? "<unknown>";
      if (id !== "0") {
        const parent = cell.attributes.parent;
        if (!parent) result.errors.push(`${prefix} Cell id="${id}" has no parent.`);
        else if (!byId.has(parent)) result.errors.push(`${prefix} Cell id="${id}" references unknown parent="${parent}".`);
      }

      if (cell.attributes.vertex === "1") {
        result.stats.vertices += 1;
        const geometry = child(cell, "mxGeometry");
        if (!geometry) {
          result.errors.push(`${prefix} Vertex id="${id}" is missing <mxGeometry>.`);
        } else {
          const width = finiteAttribute(geometry, "width");
          const height = finiteAttribute(geometry, "height");
          for (const coordinate of ["x", "y"]) {
            if (Object.hasOwn(geometry.attributes, coordinate) && finiteAttribute(geometry, coordinate) === null) {
              result.errors.push(`${prefix} Vertex id="${id}" has invalid ${coordinate}.`);
            }
          }
          if (width === null || width <= 0) result.errors.push(`${prefix} Vertex id="${id}" has invalid width.`);
          if (height === null || height <= 0) result.errors.push(`${prefix} Vertex id="${id}" has invalid height.`);
        }
        const style = cell.attributes.style ?? "";
        if (!style.includes("whiteSpace=wrap")) {
          result.warnings.push(`${prefix} Vertex id="${id}" does not enable whiteSpace=wrap.`);
        }
        if (!style.includes("html=1")) {
          result.warnings.push(`${prefix} Vertex id="${id}" does not enable html=1.`);
        }
      }

      if (cell.attributes.edge === "1") {
        result.stats.edges += 1;
        const geometry = child(cell, "mxGeometry");
        if (!geometry || geometry.attributes.relative !== "1") {
          result.errors.push(`${prefix} Edge id="${id}" requires relative geometry.`);
        }
        const points = geometry ? children(geometry, "mxPoint") : [];
        const hasSourcePoint = points.some((point) => point.attributes.as === "sourcePoint");
        const hasTargetPoint = points.some((point) => point.attributes.as === "targetPoint");
        const source = cell.attributes.source;
        const target = cell.attributes.target;
        if (!source && !hasSourcePoint) {
          result.errors.push(`${prefix} Edge id="${id}" has no source or sourcePoint.`);
        } else if (source && !byId.has(source)) {
          result.errors.push(`${prefix} Edge id="${id}" references unknown source="${source}".`);
        }
        if (!target && !hasTargetPoint) {
          result.errors.push(`${prefix} Edge id="${id}" has no target or targetPoint.`);
        } else if (target && !byId.has(target)) {
          result.errors.push(`${prefix} Edge id="${id}" references unknown target="${target}".`);
        }
      }
    }
  });
}

export function validateDocument(source, filename = "diagram") {
  const result = {
    file: filename,
    type: "drawio",
    errors: [],
    warnings: [],
    stats: { pages: 0, cells: 0, vertices: 0, edges: 0 },
  };

  let xml = source;
  let accessibleTitle = false;
  if (/<svg\b/i.test(source.slice(0, 1000))) {
    result.type = "drawio.svg";
    try {
      const svg = parseXml(source);
      if (svg.name !== "svg") throw new Error("SVG must be the document root.");
      if (svg.attributes.role !== "img") result.errors.push("SVG must declare role=\"img\".");
      accessibleTitle = Boolean(child(svg, "title")?.text.trim());
      if (!accessibleTitle) result.errors.push("SVG must contain a non-empty accessible <title>.");
      if (!child(svg, "desc")?.text.trim()) result.errors.push("SVG must contain a non-empty accessible <desc>.");
      xml = extract(source);
    } catch (error) {
      result.errors.push(error.message);
      return result;
    }
  }

  validateMxfile(xml, result, { accessibleTitle });
  return result;
}

function printResult(result) {
  console.log(`Validating: ${result.file}`);
  console.log(
    `Type: ${result.type} | Pages: ${result.stats.pages} | ` +
    `Vertices: ${result.stats.vertices} | Edges: ${result.stats.edges}`,
  );
  for (const warning of result.warnings) console.log(`WARNING: ${warning}`);
  for (const error of result.errors) console.log(`ERROR: ${error}`);
  console.log(result.errors.length ? `FAIL - ${result.errors.length} error(s).` : "PASS - No structural errors.");
}

function main(argv) {
  const json = argv.includes("--json");
  const positional = argv.filter((value) => value !== "--json");
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(HELP);
    return 0;
  }
  const unknown = positional.find((value) => value.startsWith("-"));
  if (unknown) {
    console.error(`Unknown option: ${unknown}`);
    return 2;
  }
  if (positional.length !== 1) {
    console.error(HELP);
    return 2;
  }
  const file = resolve(positional[0]);
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch (error) {
    console.error(`validate-drawio: ${error.message}`);
    return 2;
  }
  const result = validateDocument(source, file);
  if (json) console.log(JSON.stringify(result, null, 2));
  else printResult(result);
  return result.errors.length ? 1 : 0;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
