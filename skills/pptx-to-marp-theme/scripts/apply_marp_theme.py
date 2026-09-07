#!/usr/bin/env python3
"""Preview or apply a generated Marp theme to existing Markdown decks."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def theme_metadata(css: str) -> tuple[str, str | None]:
    theme = re.search(r"/\*\s*@theme\s+([a-z][a-z0-9-]{1,63})\s*\*/", css)
    if not theme:
        raise ValueError("Theme CSS does not declare /* @theme <name> */.")
    size = re.search(r"/\*\s*@size\s+(\S+)\s+\S+\s+\S+\s*\*/", css)
    return theme.group(1), size.group(1) if size else None


def split_frontmatter(markdown: str) -> tuple[list[str], list[str], str]:
    newline = "\r\n" if "\r\n" in markdown else "\n"
    lines = markdown.replace("\r\n", "\n").split("\n")
    if not lines or lines[0].strip() != "---":
        return [], lines, newline
    end = next((index for index, line in enumerate(lines[1:], 1) if line.strip() == "---"), None)
    if end is None:
        raise ValueError("Markdown starts with frontmatter but has no closing delimiter.")
    return lines[1:end], lines[end + 1:], newline


def set_scalar(lines: list[str], key: str, value: str) -> tuple[list[str], str | None]:
    pattern = re.compile(rf"^{re.escape(key)}\s*:\s*(.*?)\s*$")
    matches = [index for index, line in enumerate(lines) if pattern.match(line)]
    if len(matches) > 1:
        raise ValueError(f"Frontmatter contains duplicate '{key}' keys.")
    previous = pattern.match(lines[matches[0]]).group(1) if matches else None
    updated = list(lines)
    replacement = f"{key}: {value}"
    if matches:
        updated[matches[0]] = replacement
    else:
        updated.append(replacement)
    return updated, previous


def classes_in_deck(markdown: str) -> set[str]:
    classes: set[str] = set()
    for match in re.finditer(r"<!--\s*_class:\s*([^>]+?)\s*-->", markdown):
        classes.update(part for part in match.group(1).split() if part)
    return classes


def html_classes_in_deck(markdown: str) -> set[str]:
    classes: set[str] = set()
    for match in re.finditer(r"class\s*=\s*['\"]([^'\"]+)['\"]", markdown):
        classes.update(part for part in match.group(1).split() if part)
    return classes


def classes_in_theme(css: str) -> set[str]:
    supported = {"lead", "invert"}
    for match in re.finditer(r"\bsection((?:\.[A-Za-z_][A-Za-z0-9_-]*)+)", css):
        supported.update(part for part in match.group(1).split(".") if part)
    return supported


def missing_theme_assets(css_path: Path, css: str) -> list[str]:
    missing = []
    for match in re.finditer(r"url\(\s*['\"]?([^'\"\)]+)", css):
        value = match.group(1).strip()
        if re.match(r"^(?:https?:|data:|#)", value):
            continue
        target = (css_path.parent / value).resolve()
        if not target.exists():
            missing.append(value)
    return sorted(set(missing))


def update_deck(markdown: str, theme: str, size: str | None) -> tuple[str, dict]:
    frontmatter, body, newline = split_frontmatter(markdown)
    frontmatter, old_marp = set_scalar(frontmatter, "marp", "true")
    frontmatter, old_theme = set_scalar(frontmatter, "theme", theme)
    old_size = None
    if size:
        frontmatter, old_size = set_scalar(frontmatter, "size", size)
    updated = ["---", *frontmatter, "---", *body]
    return newline.join(updated), {
        "marp": {"before": old_marp, "after": "true"},
        "theme": {"before": old_theme, "after": theme},
        "size": {"before": old_size, "after": size} if size else None,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("theme_css", help="Generated Marp theme CSS")
    parser.add_argument("decks", nargs="+", help="Existing Marp Markdown decks")
    parser.add_argument("--write", action="store_true", help="Apply changes; default is dry-run")
    parser.add_argument("--use-template-size", action="store_true", help="Apply the generated @size name")
    parser.add_argument("--json", action="store_true", help="Print machine-readable output")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    css_path = Path(args.theme_css)
    if not css_path.is_file():
        print(f"apply-marp-theme: theme CSS not found: {css_path}", file=sys.stderr)
        return 2
    try:
        css = css_path.read_text(encoding="utf-8")
        theme, size = theme_metadata(css)
        supported_classes = classes_in_theme(css)
        asset_warnings = missing_theme_assets(css_path, css)
        results = []
        for deck_value in args.decks:
            deck = Path(deck_value)
            if not deck.is_file():
                raise ValueError(f"Deck not found: {deck}")
            markdown = deck.read_text(encoding="utf-8")
            updated, changes = update_deck(
                markdown,
                theme,
                size if args.use_template_size else None,
            )
            used_classes = classes_in_deck(markdown)
            html_classes = html_classes_in_deck(markdown)
            unsupported = sorted(used_classes - supported_classes)
            external_dependencies = []
            if (
                any(name == "fa" or name.startswith("fa-") for name in html_classes)
                and "fontawesome" not in css.lower()
            ):
                external_dependencies.append(
                    "Font Awesome classes are present; preserve or replace the icon stylesheet."
                )
            if "mermaid" in html_classes or "```mermaid" in markdown:
                external_dependencies.append(
                    "Runtime Mermaid is present; preserve its renderer or pre-render diagrams to SVG."
                )
            result = {
                "deck": str(deck.resolve()),
                "themeCss": str(css_path.resolve()),
                "write": args.write,
                "changed": updated != markdown,
                "changes": changes,
                "classes": {
                    "used": sorted(used_classes),
                    "unsupported": unsupported,
                    "html": sorted(html_classes),
                },
                "externalDependencies": external_dependencies,
                "warnings": (
                    [f"Theme asset is missing: {asset}" for asset in asset_warnings] +
                    [f"Deck class is not defined by the generated theme: {name}" for name in unsupported] +
                    external_dependencies
                ),
            }
            if args.write and updated != markdown:
                with deck.open("w", encoding="utf-8", newline="") as stream:
                    stream.write(updated)
            results.append(result)
    except (OSError, UnicodeError, ValueError) as exc:
        print(f"apply-marp-theme: {exc}", file=sys.stderr)
        return 1

    payload = {"ok": True, "mode": "write" if args.write else "dry-run", "results": results}
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        for result in results:
            action = "Updated" if args.write and result["changed"] else "Would update" if result["changed"] else "Unchanged"
            print(f"{action}: {result['deck']}")
            print(f"  theme: {result['changes']['theme']['before']} -> {result['changes']['theme']['after']}")
            if result["changes"]["size"]:
                print(f"  size: {result['changes']['size']['before']} -> {result['changes']['size']['after']}")
            for warning in result["warnings"]:
                print(f"  Warning: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
