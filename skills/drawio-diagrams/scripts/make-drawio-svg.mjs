#!/usr/bin/env node
/**
 * make-drawio-svg.mjs — author and inspect editable `.drawio.svg` diagrams.
 *
 * A `.drawio.svg` is an ordinary SVG (so it renders as an image anywhere) whose
 * root <svg> element also carries a `content="…"` attribute holding the draw.io
 * `mxfile` XML, HTML-escaped. draw.io / diagrams.net and the Draw.io Integration
 * VS Code extension read that attribute, so the same file both *displays* and
 * *re-opens fully editable*.
 *
 * This helper renders a simple JSON node/edge spec to SVG shapes AND embeds a
 * matching `mxGraphModel`, so the diagram is editable in draw.io with no draw.io
 * install required. Dependency-free — plain Node, no npm packages.
 *
 * Commands:
 *   build   <spec.json> -o <out.drawio.svg>   Render spec -> editable .drawio.svg (default)
 *   extract <in.drawio.svg>                    Print the embedded mxfile XML (for editing)
 *
 * Examples:
 *   node <skill-directory>/scripts/make-drawio-svg.mjs build spec.json -o slides/img/flow.drawio.svg
 *   node <skill-directory>/scripts/make-drawio-svg.mjs extract slides/img/flow.drawio.svg
 *
 * Spec format (see example.spec.json in this folder):
 *   {
 *     "nodes": [
 *       { "id": "a", "label": "Start", "x": 40, "y": 40,
 *         "width": 140, "height": 60,
 *         "fill": "#dae8fc", "stroke": "#6c8ebf", "fontColor": "#000000",
 *         "rounded": true }
 *     ],
 *     "edges": [
 *       { "source": "a", "target": "b", "label": "yes" }
 *     ]
 *   }
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- shared helpers ----------

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Value stored in the SVG `content` attribute (double-quoted), so escape for an
// attribute context and turn newlines into numeric entities.
function attrEscape(s) {
  return xmlEscape(s).replace(/\n/g, '&#10;');
}

function finiteNumber(value, label, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a finite number between ${min} and ${max}.`);
  }
  return parsed;
}

function color(value, fallback, label, allowTransparent = false) {
  const actual = value ?? fallback;
  if (allowTransparent && actual === 'transparent') return actual;
  if (actual === 'none' || /^#[0-9a-f]{6}$/i.test(actual)) return actual;
  throw new Error(`${label} must be "none" or a six-digit hex color.`);
}

function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value)) {
    throw new Error(`${label} must be 1-64 characters and use letters, numbers, _, ., :, or -.`);
  }
  if (value === '0' || value === '1') throw new Error(`${label} cannot use reserved id "${value}".`);
  return value;
}

function safeStyle(value, label) {
  if (value === undefined) return '';
  if (typeof value !== 'string' || value.length > 1000 || /[<>"\u0000-\u001f]/.test(value)) {
    throw new Error(`${label} contains unsupported characters or is too long.`);
  }
  return value.trim();
}

export function validateSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Spec must be a JSON object.');
  }
  if (typeof input.title !== 'string' || !input.title.trim()) {
    throw new Error('Spec must contain a non-empty "title".');
  }
  if (input.title.length > 200) throw new Error('Spec title must be 200 characters or fewer.');
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) {
    throw new Error('Spec must contain a non-empty "nodes" array.');
  }

  const ids = new Set(['0', '1']);
  const nodeIds = new Set();
  const nodes = input.nodes.map((node, index) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new Error(`Node ${index + 1} must be an object.`);
    }
    const id = identifier(node.id, `Node ${index + 1} id`);
    if (ids.has(id)) throw new Error(`Duplicate cell id="${id}".`);
    ids.add(id);
    nodeIds.add(id);
    const label = node.label === undefined ? '' : String(node.label);
    if (label.length > 500) throw new Error(`Node "${id}" label must be 500 characters or fewer.`);
    const shape = node.shape ?? (node.rounded ? 'rounded' : 'rectangle');
    if (!['rectangle', 'rounded', 'ellipse', 'diamond', 'cylinder'].includes(shape)) {
      throw new Error(`Node "${id}" has unsupported shape "${shape}".`);
    }
    return {
      id,
      label,
      x: finiteNumber(node.x, `Node "${id}" x`, { min: 0, max: 100000 }),
      y: finiteNumber(node.y, `Node "${id}" y`, { min: 0, max: 100000 }),
      width: finiteNumber(node.width, `Node "${id}" width`, { min: 1, max: 10000 }),
      height: finiteNumber(node.height, `Node "${id}" height`, { min: 1, max: 10000 }),
      shape,
      fill: color(node.fill, '#ffffff', `Node "${id}" fill`),
      stroke: color(node.stroke, '#000000', `Node "${id}" stroke`),
      fontColor: color(node.fontColor, '#000000', `Node "${id}" fontColor`),
      strokeWidth: finiteNumber(node.strokeWidth ?? 1.5, `Node "${id}" strokeWidth`, { min: 0.5, max: 12 }),
      fontSize: finiteNumber(node.fontSize ?? 13, `Node "${id}" fontSize`, { min: 8, max: 72 }),
      dashed: node.dashed === true,
      style: safeStyle(node.style, `Node "${id}" style`),
    };
  });

  let generatedEdge = 0;
  const edges = (input.edges ?? []).map((edge, index) => {
    if (!edge || typeof edge !== 'object' || Array.isArray(edge)) {
      throw new Error(`Edge ${index + 1} must be an object.`);
    }
    let id = edge.id;
    if (id === undefined) {
      do id = `e${++generatedEdge}`;
      while (ids.has(id));
    }
    id = identifier(id, `Edge ${index + 1} id`);
    if (ids.has(id)) throw new Error(`Duplicate cell id="${id}".`);
    ids.add(id);
    const source = identifier(edge.source, `Edge "${id}" source`);
    const target = identifier(edge.target, `Edge "${id}" target`);
    if (!nodeIds.has(source)) throw new Error(`Edge "${id}" references unknown source="${source}".`);
    if (!nodeIds.has(target)) throw new Error(`Edge "${id}" references unknown target="${target}".`);
    if (source === target) throw new Error(`Edge "${id}" self-links are not supported by this helper.`);
    const label = edge.label === undefined ? '' : String(edge.label);
    if (label.length > 200) throw new Error(`Edge "${id}" label must be 200 characters or fewer.`);
    if (typeof input.description === 'string' && input.description.length > 500) {
      throw new Error('Spec description must be 500 characters or fewer.');
    }
    return {
      id,
      source,
      target,
      label,
      orthogonal: edge.orthogonal === true,
      dashed: edge.dashed === true,
      strokeWidth: finiteNumber(edge.strokeWidth ?? 1.5, `Edge "${id}" strokeWidth`, { min: 0.5, max: 12 }),
      endArrow: edge.endArrow === 'none' ? 'none' : 'block',
    };
  });

  return {
    title: input.title.trim(),
    description: typeof input.description === 'string' && input.description.trim()
      ? input.description.trim()
      : input.title.trim(),
    background: color(input.background, '#ffffff', 'background', true),
    padding: finiteNumber(input.padding ?? 20, 'padding', { min: 0, max: 200 }),
    nodes,
    edges,
  };
}

function borderPoint(rect, towardX, towardY) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = rect.width / 2;
  const hh = rect.height / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

// ---------- build command ----------

function styleFor(node) {
  const parts = [];
  if (node.shape === 'ellipse') parts.push('ellipse');
  else if (node.shape === 'diamond') parts.push('rhombus');
  else if (node.shape === 'cylinder') parts.push('shape=cylinder3');
  else parts.push(node.shape === 'rounded' ? 'rounded=1' : 'rounded=0');
  parts.push('whiteSpace=wrap', 'html=1');
  parts.push(`fillColor=${node.fill}`);
  parts.push(`strokeColor=${node.stroke}`);
  parts.push(`fontColor=${node.fontColor}`);
  parts.push(`strokeWidth=${node.strokeWidth}`);
  parts.push(`fontSize=${node.fontSize}`);
  if (node.dashed) parts.push('dashed=1');
  if (node.style) parts.push(node.style); // raw extra draw.io style
  return parts.join(';') + ';';
}

function buildModel(spec, width, height) {
  // mxGraphModel with matching geometry so draw.io reopens an identical diagram.
  const cells = ['<mxCell id="0" />', '<mxCell id="1" parent="0" />'];
  for (const n of spec.nodes) {
    cells.push(
      `<mxCell id="${xmlEscape(n.id)}" value="${attrEscape(n.label ?? '')}" ` +
      `style="${xmlEscape(styleFor(n))}" vertex="1" parent="1">` +
      `<mxGeometry x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" as="geometry" />` +
      `</mxCell>`
    );
  }
  for (const e of spec.edges) {
    const edgeStyle = e.orthogonal
      ? 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;'
      : 'edgeStyle=none;rounded=0;html=1;';
    cells.push(
      `<mxCell id="${xmlEscape(e.id)}" value="${attrEscape(e.label)}" ` +
      `style="${xmlEscape(edgeStyle + `strokeWidth=${e.strokeWidth};` + (e.dashed ? 'dashed=1;' : '') + (e.endArrow === 'none' ? 'endArrow=none;' : ''))}" edge="1" parent="1" ` +
      `source="${xmlEscape(e.source)}" target="${xmlEscape(e.target)}">` +
      `<mxGeometry relative="1" as="geometry" />` +
      `</mxCell>`
    );
  }
  const model =
    `<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" ` +
    `tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" ` +
    `pageWidth="${width}" pageHeight="${height}" math="0" shadow="0">` +
    `<root>${cells.join('')}</root></mxGraphModel>`;
  return `<mxfile host="make-drawio-svg" type="device">` +
    `<diagram id="page-1" name="${attrEscape(spec.title)}">${model}</diagram></mxfile>`;
}

function shapeSvg(n) {
  const dash = n.dashed ? ' stroke-dasharray="8 5"' : '';
  const common = `fill="${n.fill}" stroke="${n.stroke}" stroke-width="${n.strokeWidth}"${dash}`;
  if (n.shape === 'ellipse') {
    return `<ellipse cx="${n.x + n.width / 2}" cy="${n.y + n.height / 2}" rx="${n.width / 2}" ry="${n.height / 2}" ${common} />`;
  }
  if (n.shape === 'diamond') {
    const points = [
      `${n.x + n.width / 2},${n.y}`,
      `${n.x + n.width},${n.y + n.height / 2}`,
      `${n.x + n.width / 2},${n.y + n.height}`,
      `${n.x},${n.y + n.height / 2}`,
    ].join(' ');
    return `<polygon points="${points}" ${common} />`;
  }
  if (n.shape === 'cylinder') {
    const ry = Math.min(12, n.height / 6);
    return (
      `<path d="M ${n.x} ${n.y + ry} C ${n.x} ${n.y}, ${n.x + n.width} ${n.y}, ${n.x + n.width} ${n.y + ry} ` +
      `L ${n.x + n.width} ${n.y + n.height - ry} C ${n.x + n.width} ${n.y + n.height}, ${n.x} ${n.y + n.height}, ${n.x} ${n.y + n.height - ry} Z" ${common} />` +
      `<ellipse cx="${n.x + n.width / 2}" cy="${n.y + ry}" rx="${n.width / 2}" ry="${ry}" ${common} />` +
      `<path d="M ${n.x} ${n.y + n.height - ry} C ${n.x} ${n.y + n.height}, ${n.x + n.width} ${n.y + n.height}, ${n.x + n.width} ${n.y + n.height - ry}" fill="none" stroke="${n.stroke}" stroke-width="${n.strokeWidth}"${dash} />`
    );
  }
  const rx = n.shape === 'rounded' ? Math.min(12, n.height / 4) : 0;
  return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="${rx}" ry="${rx}" ${common} />`;
}

function renderNode(n) {
  const cx = n.x + n.width / 2;
  const lines = n.label.split('\n');
  const lineHeight = n.fontSize + 3;
  const startY = n.y + n.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const tspans = lines
    .map((ln, i) =>
      `<tspan x="${cx}" y="${startY + i * lineHeight + n.fontSize * 0.35}">${xmlEscape(ln)}</tspan>`)
    .join('');
  return (
    shapeSvg(n) +
    `<text text-anchor="middle" font-family="Helvetica, Arial, sans-serif" ` +
    `font-size="${n.fontSize}" fill="${n.fontColor}">${tspans}</text>`
  );
}

function orthogonalRoute(source, target) {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  if (Math.abs(tc.x - sc.x) >= Math.abs(tc.y - sc.y)) {
    const direction = tc.x >= sc.x ? 1 : -1;
    const start = { x: sc.x + direction * source.width / 2, y: sc.y };
    const end = { x: tc.x - direction * target.width / 2, y: tc.y };
    const middle = (start.x + end.x) / 2;
    return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
  }
  const direction = tc.y >= sc.y ? 1 : -1;
  const start = { x: sc.x, y: sc.y + direction * source.height / 2 };
  const end = { x: tc.x, y: tc.y - direction * target.height / 2 };
  const middle = (start.y + end.y) / 2;
  return [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
}

function pointAtHalfLength(points) {
  const segments = points.slice(1).map((point, index) => {
    const start = points[index];
    return {
      start,
      end: point,
      length: Math.hypot(point.x - start.x, point.y - start.y),
    };
  });
  const target = segments.reduce((sum, segment) => sum + segment.length, 0) / 2;
  let walked = 0;
  for (const segment of segments) {
    if (walked + segment.length >= target) {
      const ratio = segment.length === 0 ? 0 : (target - walked) / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }
    walked += segment.length;
  }
  return points.at(-1);
}

function renderEdge(e, byId) {
  const s = byId.get(e.source);
  const t = byId.get(e.target);
  if (!s || !t) throw new Error(`Edge references unknown node: ${e.source} -> ${e.target}`);
  const sc = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  const tc = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  const points = e.orthogonal
    ? orthogonalRoute(s, t)
    : [borderPoint(s, tc.x, tc.y), borderPoint(t, sc.x, sc.y)];
  const pathData = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const dash = e.dashed ? ' stroke-dasharray="8 5"' : '';
  const marker = e.endArrow === 'none' ? '' : ' marker-end="url(#arrow)"';
  const path =
    `<path d="${pathData}" fill="none" stroke="#333333" ` +
    `stroke-width="${e.strokeWidth}"${dash}${marker} />`;
  let label = '';
  if (e.label) {
    const middlePoint = pointAtHalfLength(points);
    const mx = middlePoint.x;
    const my = middlePoint.y;
    const w = String(e.label).length * 7 + 8;
    label =
      `<rect x="${mx - w / 2}" y="${my - 10}" width="${w}" height="18" ` +
      `fill="#ffffff" stroke="none" />` +
      `<text x="${mx}" y="${my + 3}" text-anchor="middle" ` +
      `font-family="Helvetica, Arial, sans-serif" font-size="12" ` +
      `fill="#333333">${xmlEscape(e.label)}</text>`;
  }
  return path + label;
}

export function build(input) {
  const spec = validateSpec(input);
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  const maxX = Math.max(...spec.nodes.map((n) => n.x + n.width));
  const maxY = Math.max(...spec.nodes.map((n) => n.y + n.height));
  const width = maxX + spec.padding;
  const height = maxY + spec.padding;

  const defs =
    `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" ` +
    `orient="auto" markerUnits="strokeWidth">` +
    `<path d="M0,0 L8,3 L0,6 Z" fill="#333333" /></marker></defs>`;
  const edges = spec.edges.map((e) => renderEdge(e, byId)).join('');
  const nodes = spec.nodes.map(renderNode).join('');
  const content = attrEscape(buildModel(spec, width, height));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `role="img" aria-labelledby="diagram-title diagram-description" ` +
    `width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" ` +
    `content="${content}">` +
    `<title id="diagram-title">${xmlEscape(spec.title)}</title>` +
    `<desc id="diagram-description">${xmlEscape(spec.description)}</desc>` +
    defs +
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${spec.background}" />` +
    edges + nodes +
    `</svg>\n`
  );
}

// ---------- extract command ----------

function unescapeAttr(s) {
  return s
    .replace(/&#10;/g, '\n')
    .replace(/&#xa;/gi, '\n')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

export function extract(svgText) {
  // Grab the root <svg …> tag and read its content="" attribute.
  const openTag = svgText.match(/<svg\b[^>]*>/s);
  if (!openTag) throw new Error('No <svg> element found.');
  const m = openTag[0].match(/\scontent="([\s\S]*?)"/);
  if (!m) {
    throw new Error('This SVG has no embedded draw.io "content" attribute — it is not an editable .drawio.svg.');
  }
  return unescapeAttr(m[1]);
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const args = { cmd: 'build', input: null, out: null };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('-')) {
    if (['build', 'extract'].includes(rest[0])) args.cmd = rest.shift();
  }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '-o' || a === '--out') args.out = rest[++i];
    else if (a === '-h' || a === '--help') { args.help = true; }
    else if (!a.startsWith('-') && args.input == null) args.input = a;
    else { throw new Error(`Unexpected argument: ${a}`); }
  }
  return args;
}

const HELP = `Author and inspect editable .drawio.svg diagrams.

Usage:
  node make-drawio-svg.mjs build <spec.json> -o <out.drawio.svg>
  node make-drawio-svg.mjs extract <in.drawio.svg>

build    Render a JSON node/edge spec to an editable .drawio.svg (default)
extract  Print the embedded draw.io mxfile XML from a .drawio.svg`;

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exit(2); }
  if (args.help || !args.input) { console.log(HELP); process.exit(args.input ? 0 : 2); }

  try {
    if (args.cmd === 'extract') {
      const svg = readFileSync(args.input, 'utf8');
      process.stdout.write(extract(svg) + '\n');
      return;
    }
    // build
    const spec = JSON.parse(readFileSync(args.input, 'utf8'));
    const svg = build(spec);
    if (args.out) {
      const output = resolve(args.out);
      mkdirSync(dirname(output), { recursive: true });
      writeFileSync(output, svg);
      console.error(`Wrote ${output}`);
    } else {
      process.stdout.write(svg);
    }
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(2);
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
