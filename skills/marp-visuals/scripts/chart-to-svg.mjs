#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HELP = `Generate an accessible SVG chart from JSON.

Usage:
  node scripts/chart-to-svg.mjs <chart.json> -o <chart.svg>

Supported chart types: bar, line`;

const PALETTE = ["#0969da", "#1a7f37", "#bf8700", "#cf222e", "#8250df", "#0a7c86"];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function number(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
}

function color(value, fallback, label) {
  if (value === undefined) return fallback;
  if (!/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${label} must be a six-digit hex color.`);
  }
  return value;
}

function validateSpec(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Chart specification must be a JSON object.");
  }
  if (!["bar", "line"].includes(input.type)) {
    throw new Error('Chart "type" must be "bar" or "line".');
  }
  if (typeof input.title !== "string" || !input.title.trim()) {
    throw new Error('Chart "title" is required.');
  }
  if (!Array.isArray(input.series) || input.series.length === 0 || input.series.length > 6) {
    throw new Error('Chart "series" must contain between 1 and 6 series.');
  }

  const width = input.width === undefined ? 1200 : number(input.width, "width");
  const height = input.height === undefined ? 675 : number(input.height, "height");
  if (width < 640 || width > 2400 || height < 360 || height > 1600) {
    throw new Error("Chart dimensions must be between 640x360 and 2400x1600.");
  }

  const normalizedSeries = input.series.map((series, seriesIndex) => {
    if (!series || typeof series !== "object") {
      throw new Error(`Series ${seriesIndex + 1} must be an object.`);
    }
    if (typeof series.name !== "string" || !series.name.trim()) {
      throw new Error(`Series ${seriesIndex + 1} requires a name.`);
    }
    if (!Array.isArray(series.values) || series.values.length === 0) {
      throw new Error(`Series "${series.name}" requires values.`);
    }
    const color = series.color ?? PALETTE[seriesIndex];
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      throw new Error(`Series "${series.name}" color must be a six-digit hex color.`);
    }
    return {
      name: series.name.trim(),
      color,
      values: series.values.map((point, pointIndex) => {
        if (!point || typeof point.label !== "string" || !point.label.trim()) {
          throw new Error(`Series "${series.name}" point ${pointIndex + 1} requires a label.`);
        }
        return {
          label: point.label.trim(),
          value: number(point.value, `Series "${series.name}" point "${point.label}"`),
        };
      }),
    };
  });

  const labels = normalizedSeries[0].values.map(({ label }) => label);
  for (const series of normalizedSeries.slice(1)) {
    assertSameLabels(labels, series);
  }

  return {
    type: input.type,
    title: input.title.trim(),
    description: typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : `${input.type} chart showing ${input.title.trim()}`,
    width,
    height,
    xLabel: typeof input.xLabel === "string" ? input.xLabel.trim() : "",
    yLabel: typeof input.yLabel === "string" ? input.yLabel.trim() : "",
    source: typeof input.source === "string" ? input.source.trim() : "",
    showValues: input.showValues !== false,
    background: color(input.background, "#ffffff", "background"),
    foreground: color(input.foreground, "#24292f", "foreground"),
    grid: color(input.grid, "#d0d7de", "grid"),
    series: normalizedSeries,
    labels,
  };
}

function assertSameLabels(labels, series) {
  const actual = series.values.map(({ label }) => label);
  if (actual.length !== labels.length || actual.some((label, index) => label !== labels[index])) {
    throw new Error(`Series "${series.name}" must use the same ordered labels as the first series.`);
  }
}

function formatValue(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function niceStep(range, targetIntervals = 5) {
  const rough = range / targetIntervals;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

function renderLegend(spec, startX, y) {
  return spec.series.map((series, index) => {
    const x = startX + index * 180;
    return `<g><rect x="${x}" y="${y - 12}" width="18" height="18" rx="3" fill="${series.color}"/>` +
      `<text x="${x + 28}" y="${y + 2}" font-size="18">${escapeXml(series.name)}</text></g>`;
  }).join("");
}

export function renderChart(input) {
  const spec = validateSpec(input);
  const margin = { top: 110, right: 45, bottom: spec.source ? 105 : 85, left: 105 };
  const plot = {
    x: margin.left,
    y: margin.top,
    width: spec.width - margin.left - margin.right,
    height: spec.height - margin.top - margin.bottom,
  };
  const allValues = spec.series.flatMap((series) => series.values.map(({ value }) => value));
  const dataMin = Math.min(0, ...allValues);
  const dataMax = Math.max(0, ...allValues);
  const step = niceStep(dataMax === dataMin ? 1 : dataMax - dataMin);
  const min = Math.floor(dataMin / step) * step;
  const max = Math.ceil((dataMax === dataMin ? dataMax + step : dataMax) / step) * step;
  const y = (value) => plot.y + ((max - value) / (max - min)) * plot.height;
  const baseline = y(0);
  const parts = [];

  parts.push(`<rect width="${spec.width}" height="${spec.height}" fill="${spec.background}"/>`);
  parts.push(`<text x="${margin.left}" y="48" font-size="34" font-weight="700">${escapeXml(spec.title)}</text>`);
  parts.push(renderLegend(spec, margin.left, 82));

  for (let value = min; value <= max + step / 1000; value += step) {
    const tickY = y(value);
    parts.push(`<line x1="${plot.x}" y1="${tickY}" x2="${plot.x + plot.width}" y2="${tickY}" stroke="${spec.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${plot.x - 14}" y="${tickY + 6}" text-anchor="end" font-size="17">${escapeXml(formatValue(value))}</text>`);
  }

  parts.push(`<line x1="${plot.x}" y1="${baseline}" x2="${plot.x + plot.width}" y2="${baseline}" stroke="${spec.foreground}" stroke-width="2"/>`);
  parts.push(`<line x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y + plot.height}" stroke="${spec.foreground}" stroke-width="2"/>`);

  const categoryWidth = plot.width / spec.labels.length;
  const categoryX = (index) => spec.type === "line"
    ? (spec.labels.length === 1
      ? plot.x + plot.width / 2
      : plot.x + (plot.width * index) / (spec.labels.length - 1))
    : plot.x + categoryWidth * (index + 0.5);
  const rotateLabels = spec.labels.length > 8 || spec.labels.some((label) => label.length > 12);
  spec.labels.forEach((label, index) => {
    const x = categoryX(index);
    const labelY = plot.y + plot.height + 30;
    const transform = rotateLabels ? ` transform="rotate(-35 ${x} ${labelY})"` : "";
    const anchor = rotateLabels ? "end" : "middle";
    parts.push(`<text x="${x}" y="${labelY}" text-anchor="${anchor}" font-size="17"${transform}>${escapeXml(label)}</text>`);
  });

  if (spec.type === "bar") {
    const groupWidth = categoryWidth * 0.72;
    const barWidth = Math.max(4, groupWidth / spec.series.length);
    spec.series.forEach((series, seriesIndex) => {
      series.values.forEach(({ value }, pointIndex) => {
        const valueY = y(value);
        const x = plot.x + categoryWidth * pointIndex + (categoryWidth - groupWidth) / 2 + barWidth * seriesIndex;
        const rectY = Math.min(valueY, baseline);
        const height = Math.max(1, Math.abs(baseline - valueY));
        parts.push(`<rect x="${x}" y="${rectY}" width="${Math.max(1, barWidth - 4)}" height="${height}" rx="3" fill="${series.color}"/>`);
        if (spec.showValues) {
          const labelY = value >= 0 ? rectY - 8 : rectY + height + 20;
          parts.push(`<text x="${x + (barWidth - 4) / 2}" y="${labelY}" text-anchor="middle" font-size="16" font-weight="600">${escapeXml(formatValue(value))}</text>`);
        }
      });
    });
  } else {
    spec.series.forEach((series) => {
      const points = series.values.map(({ value }, index) => `${categoryX(index)},${y(value)}`).join(" ");
      parts.push(`<polyline points="${points}" fill="none" stroke="${series.color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
      series.values.forEach(({ value }, index) => {
        const pointX = categoryX(index);
        const pointY = y(value);
        parts.push(`<circle cx="${pointX}" cy="${pointY}" r="7" fill="${spec.background}" stroke="${series.color}" stroke-width="4"/>`);
        if (spec.showValues) {
          parts.push(`<text x="${pointX}" y="${pointY - 14}" text-anchor="middle" font-size="16" font-weight="600">${escapeXml(formatValue(value))}</text>`);
        }
      });
    });
  }

  if (spec.xLabel) {
    parts.push(`<text x="${plot.x + plot.width / 2}" y="${spec.height - (spec.source ? 48 : 22)}" text-anchor="middle" font-size="18" font-weight="600">${escapeXml(spec.xLabel)}</text>`);
  }
  if (spec.yLabel) {
    const center = plot.y + plot.height / 2;
    parts.push(`<text x="25" y="${center}" text-anchor="middle" font-size="18" font-weight="600" transform="rotate(-90 25 ${center})">${escapeXml(spec.yLabel)}</text>`);
  }
  if (spec.source) {
    parts.push(`<text x="${margin.left}" y="${spec.height - 18}" font-size="14" fill="#57606a">Source: ${escapeXml(spec.source)}</text>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="chart-title chart-desc" ` +
    `viewBox="0 0 ${spec.width} ${spec.height}" width="${spec.width}" height="${spec.height}">` +
    `<title id="chart-title">${escapeXml(spec.title)}</title>` +
    `<desc id="chart-desc">${escapeXml(spec.description)}</desc>` +
    `<g fill="${spec.foreground}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">` +
    parts.join("") +
    `</g></svg>\n`;
}

function parseArgs(argv) {
  const result = { input: null, output: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-h" || value === "--help") result.help = true;
    else if (value === "-o" || value === "--output") result.output = argv[++index];
    else if (value.startsWith("-")) throw new Error(`Unknown option: ${value}`);
    else if (result.input === null) result.input = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  return result;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (!args.input || !args.output) {
    console.error(HELP);
    return 2;
  }
  const input = resolve(args.input);
  const output = resolve(args.output);
  const spec = JSON.parse(readFileSync(input, "utf8"));
  const svg = renderChart(spec);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, svg);
  console.log(`Wrote ${output}`);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(`chart-to-svg: ${error.message}`);
    process.exitCode = 2;
  }
}
