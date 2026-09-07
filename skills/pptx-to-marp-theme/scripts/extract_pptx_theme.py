#!/usr/bin/env python3
"""Extract a PowerPoint theme and media into a reusable Marp theme package."""

from __future__ import annotations

import argparse
import base64
import colorsys
import hashlib
import json
import math
import posixpath
import re
import struct
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET

A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"a": A, "p": P, "r": R, "rel": REL}
R_EMBED = f"{{{R}}}embed"
EMU_PER_INCH = 914400
MAX_ARCHIVE_BYTES = 500 * 1024 * 1024
MAX_MEMBER_BYTES = 100 * 1024 * 1024
MAX_XML_BYTES = 20 * 1024 * 1024
MAX_EMBED_IMAGE_BYTES = 2 * 1024 * 1024
BROWSER_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"}
IMAGE_EXTENSIONS = BROWSER_IMAGE_EXTENSIONS | {".bmp", ".tif", ".tiff", ".emf", ".wmf"}
PRESET_COLORS = {
    "black": "000000",
    "white": "FFFFFF",
    "red": "FF0000",
    "green": "008000",
    "blue": "0000FF",
    "yellow": "FFFF00",
    "gray": "808080",
    "grey": "808080",
}
MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not slug:
        slug = "powerpoint-theme"
    if not slug[0].isalpha():
        slug = f"theme-{slug}"
    return slug[:64].rstrip("-")


def validate_theme_name(value: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", value):
        raise ValueError(
            "Theme name must be 2-64 characters, start with a letter, "
            "and contain only lowercase letters, numbers, and hyphens."
        )
    return value


def validate_css_import(value: str) -> str:
    if not value or len(value) > 500 or re.search(r"['\"\r\n;{}]", value):
        raise ValueError(f"Unsafe CSS import: {value!r}")
    if "://" in value and not value.startswith("https://"):
        raise ValueError("Remote CSS imports must use HTTPS.")
    return value


def read_member(archive: zipfile.ZipFile, name: str, *, xml: bool = False) -> bytes:
    info = archive.getinfo(name)
    limit = MAX_XML_BYTES if xml else MAX_MEMBER_BYTES
    if info.file_size > limit:
        raise ValueError(f"Archive member is too large: {name} ({info.file_size} bytes)")
    chunks: list[bytes] = []
    actual_size = 0
    try:
        with archive.open(info) as stream:
            while True:
                chunk = stream.read(min(1024 * 1024, limit + 1 - actual_size))
                if not chunk:
                    break
                chunks.append(chunk)
                actual_size += len(chunk)
                if actual_size > limit:
                    raise ValueError(
                        f"Archive member exceeds the {limit} byte limit while decompressing: {name}"
                    )
    except zipfile.BadZipFile as exc:
        raise ValueError(f"Cannot safely read archive member {name}: {exc}") from exc
    data = b"".join(chunks)

    read_members = getattr(archive, "_pptx_theme_read_members", set())
    if name not in read_members:
        actual_total = getattr(archive, "_pptx_theme_actual_total", 0) + actual_size
        if actual_total > MAX_ARCHIVE_BYTES:
            raise ValueError(
                f"Read PowerPoint content exceeds the {MAX_ARCHIVE_BYTES} byte package limit."
            )
        read_members.add(name)
        setattr(archive, "_pptx_theme_read_members", read_members)
        setattr(archive, "_pptx_theme_actual_total", actual_total)

    if xml and (b"<!DOCTYPE" in data.upper() or b"<!ENTITY" in data.upper()):
        raise ValueError(f"Unsafe XML declaration in {name}")
    return data


def read_xml(archive: zipfile.ZipFile, name: str) -> ET.Element:
    data = read_member(archive, name, xml=True)
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError(f"Cannot parse {name}: {exc}") from exc


def validate_archive(archive: zipfile.ZipFile) -> None:
    names = set(archive.namelist())
    if "[Content_Types].xml" not in names or "ppt/presentation.xml" not in names:
        raise ValueError("Input is not a valid PowerPoint Open XML package.")
    total = sum(info.file_size for info in archive.infolist())
    if total > MAX_ARCHIVE_BYTES:
        raise ValueError(f"Expanded PowerPoint package is too large ({total} bytes).")
    for info in archive.infolist():
        if info.flag_bits & 0x1:
            raise ValueError(f"Encrypted archive member is not supported: {info.filename}")
        normalized = PurePosixPath(info.filename)
        if normalized.is_absolute() or ".." in normalized.parts:
            raise ValueError(f"Unsafe archive path: {info.filename}")


def color_from_node(node: ET.Element) -> str | None:
    kind = local_name(node.tag)
    if kind == "srgbClr":
        value = node.get("val", "")
        return value.upper() if re.fullmatch(r"[0-9A-Fa-f]{6}", value) else None
    if kind == "sysClr":
        value = node.get("lastClr") or node.get("val", "")
        return value.upper() if re.fullmatch(r"[0-9A-Fa-f]{6}", value) else None
    if kind == "scrgbClr":
        try:
            channels = [max(0, min(100000, int(node.get(key, "0")))) for key in ("r", "g", "b")]
        except ValueError:
            return None
        return "".join(f"{round(channel * 255 / 100000):02X}" for channel in channels)
    if kind == "prstClr":
        return PRESET_COLORS.get(node.get("val", "").lower())
    return None


def parse_theme_file(archive: zipfile.ZipFile, theme_file: str) -> tuple[dict, dict]:
    root = read_xml(archive, theme_file)
    colors: dict[str, str] = {}
    scheme = root.find(".//a:clrScheme", NS)
    if scheme is not None:
        for entry in list(scheme):
            if len(entry):
                resolved = color_from_node(entry[0])
                if resolved:
                    colors[local_name(entry.tag)] = f"#{resolved}"

    fonts: dict[str, dict] = {}
    font_scheme = root.find(".//a:fontScheme", NS)
    if font_scheme is not None:
        for group_name, key in (("majorFont", "major"), ("minorFont", "minor")):
            group = font_scheme.find(f"a:{group_name}", NS)
            if group is None:
                continue
            values = {
                "latin": (group.find("a:latin", NS).get("typeface", "")
                          if group.find("a:latin", NS) is not None else ""),
                "eastAsian": (group.find("a:ea", NS).get("typeface", "")
                              if group.find("a:ea", NS) is not None else ""),
                "complexScript": (group.find("a:cs", NS).get("typeface", "")
                                  if group.find("a:cs", NS) is not None else ""),
                "scripts": {},
            }
            for font in group.findall("a:font", NS):
                script = font.get("script")
                typeface = font.get("typeface")
                if script and typeface:
                    values["scripts"][script] = typeface
            fonts[key] = values

    return colors, fonts


def theme_slide_usage(archive: zipfile.ZipFile) -> Counter:
    usage: Counter = Counter()
    slides = sorted(
        name for name in archive.namelist()
        if re.fullmatch(r"ppt/slides/slide\d+\.xml", name)
    )
    for slide in slides:
        layout = next(
            (target for target in relationships_for(archive, slide).values()
             if target.startswith("ppt/slideLayouts/")),
            None,
        )
        master = next(
            (target for target in relationships_for(archive, layout).values()
             if target.startswith("ppt/slideMasters/")),
            None,
        ) if layout else None
        theme = next(
            (target for target in relationships_for(archive, master).values()
             if target.startswith("ppt/theme/")),
            None,
        ) if master else None
        if theme:
            usage[theme] += 1
    return usage


def extract_theme(archive: zipfile.ZipFile) -> tuple[dict, dict, list[str], list[dict]]:
    warnings: list[str] = []
    theme_files = sorted(
        name for name in archive.namelist()
        if re.fullmatch(r"ppt/theme/theme\d+\.xml", name)
    )
    if not theme_files:
        return {}, {}, ["No ppt/theme/theme*.xml file was found."], []

    usage = theme_slide_usage(archive)
    themes = []
    for theme_file in theme_files:
        colors, fonts = parse_theme_file(archive, theme_file)
        themes.append({
            "packagePath": theme_file,
            "slideCount": usage[theme_file],
            "colors": colors,
            "fonts": fonts,
        })
    themes.sort(key=lambda item: (-item["slideCount"], item["packagePath"]))
    selected = themes[0]
    if not selected["colors"]:
        warnings.append(f"No color scheme could be resolved from {selected['packagePath']}.")
    if not selected["fonts"]:
        warnings.append(f"No font scheme could be resolved from {selected['packagePath']}.")
    if len(themes) > 1:
        warnings.append(
            f"PowerPoint package contains {len(themes)} themes; selected "
            f"{selected['packagePath']} used by {selected['slideCount']} slide(s)."
        )
    return selected["colors"], selected["fonts"], warnings, themes


def presentation_size(archive: zipfile.ZipFile) -> dict:
    root = read_xml(archive, "ppt/presentation.xml")
    size = root.find("p:sldSz", NS)
    if size is None:
        return {"cx": None, "cy": None, "widthInches": None, "heightInches": None, "ratio": 16 / 9}
    cx = int(size.get("cx", "0"))
    cy = int(size.get("cy", "0"))
    ratio = cx / cy if cy else 16 / 9
    return {
        "cx": cx,
        "cy": cy,
        "widthInches": round(cx / EMU_PER_INCH, 3) if cx else None,
        "heightInches": round(cy / EMU_PER_INCH, 3) if cy else None,
        "ratio": round(ratio, 6),
        "type": size.get("type"),
    }


def scan_usage(archive: zipfile.ZipFile) -> tuple[Counter, Counter, list[str]]:
    color_usage: Counter = Counter()
    font_usage: Counter = Counter()
    warnings: list[str] = []
    for name in archive.namelist():
        if not name.startswith(("ppt/slides/", "ppt/slideLayouts/", "ppt/slideMasters/")) or not name.endswith(".xml"):
            continue
        try:
            root = read_xml(archive, name)
        except ValueError as exc:
            warnings.append(str(exc))
            continue
        for element in root.iter():
            tag = local_name(element.tag)
            if tag == "srgbClr":
                value = color_from_node(element)
                if value:
                    color_usage[f"#{value}"] += 1
            elif tag == "sysClr":
                value = color_from_node(element)
                if value:
                    color_usage[f"#{value}"] += 1
            elif tag == "schemeClr" and element.get("val"):
                color_usage[f"scheme:{element.get('val')}"] += 1
            elif tag in {"latin", "ea", "cs", "font"} and element.get("typeface"):
                font_usage[element.get("typeface")] += 1
    return color_usage, font_usage, warnings


def relationship_path(owner: str) -> str:
    path = PurePosixPath(owner)
    return str(path.parent / "_rels" / f"{path.name}.rels")


def relationships_for(archive: zipfile.ZipFile, owner: str) -> dict[str, str]:
    rel_path = relationship_path(owner)
    if rel_path not in archive.namelist():
        return {}
    root = read_xml(archive, rel_path)
    mapping = {}
    for rel in root.findall(f"{{{REL}}}Relationship"):
        rel_id = rel.get("Id")
        target = rel.get("Target")
        if not rel_id or not target or rel.get("TargetMode") == "External":
            continue
        resolved = posixpath.normpath(posixpath.join(posixpath.dirname(owner), target))
        mapping[rel_id] = resolved
    return mapping


def image_dimensions(data: bytes, suffix: str) -> tuple[int | None, int | None, bool]:
    if suffix == ".png" and data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 26:
        width, height = struct.unpack(">II", data[16:24])
        return width, height, data[25] in {4, 6}
    if suffix in {".jpg", ".jpeg"} and data.startswith(b"\xff\xd8"):
        offset = 2
        while offset + 9 < len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            marker = data[offset + 1]
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                height, width = struct.unpack(">HH", data[offset + 5:offset + 9])
                return width, height, False
            if offset + 4 > len(data):
                break
            length = struct.unpack(">H", data[offset + 2:offset + 4])[0]
            offset += max(2, length + 2)
    if suffix == ".gif" and data[:6] in {b"GIF87a", b"GIF89a"} and len(data) >= 10:
        width, height = struct.unpack("<HH", data[6:10])
        return width, height, False
    return None, None, False


def owner_kind(name: str) -> str:
    if name.startswith("ppt/slideMasters/"):
        return "master"
    if name.startswith("ppt/slideLayouts/"):
        return "layout"
    return "slide"


def media_occurrences(archive: zipfile.ZipFile, size: dict) -> dict[str, list[dict]]:
    occurrences: dict[str, list[dict]] = defaultdict(list)
    owners = sorted(
        name for name in archive.namelist()
        if re.fullmatch(r"ppt/(?:slideMasters/slideMaster|slideLayouts/slideLayout|slides/slide)\d+\.xml", name)
    )
    slide_cx = size.get("cx") or 0
    slide_cy = size.get("cy") or 0

    for owner in owners:
        root = read_xml(archive, owner)
        rels = relationships_for(archive, owner)
        seen: set[int] = set()
        for picture in root.findall(".//p:pic", NS):
            blip = picture.find(".//a:blip", NS)
            if blip is None or not blip.get(R_EMBED):
                continue
            seen.add(id(blip))
            target = rels.get(blip.get(R_EMBED))
            if not target or not target.startswith("ppt/media/"):
                continue
            xfrm = picture.find(".//a:xfrm", NS)
            off = xfrm.find("a:off", NS) if xfrm is not None else None
            ext = xfrm.find("a:ext", NS) if xfrm is not None else None
            geometry = None
            if off is not None and ext is not None:
                x = int(off.get("x", "0"))
                y = int(off.get("y", "0"))
                cx = int(ext.get("cx", "0"))
                cy = int(ext.get("cy", "0"))
                area_ratio = (cx * cy) / (slide_cx * slide_cy) if slide_cx and slide_cy else None
                near_edge = bool(
                    slide_cx and slide_cy and (
                        x < slide_cx * 0.12 or y < slide_cy * 0.12 or
                        x + cx > slide_cx * 0.88 or y + cy > slide_cy * 0.88
                    )
                )
                geometry = {
                    "x": x, "y": y, "cx": cx, "cy": cy,
                    "areaRatio": round(area_ratio, 5) if area_ratio is not None else None,
                    "nearEdge": near_edge,
                }
            occurrences[target].append({"owner": owner, "context": owner_kind(owner), "geometry": geometry})

        for blip in root.findall(".//a:blip", NS):
            if id(blip) in seen or not blip.get(R_EMBED):
                continue
            target = rels.get(blip.get(R_EMBED))
            if target and target.startswith("ppt/media/"):
                occurrences[target].append({"owner": owner, "context": owner_kind(owner), "geometry": None})
    return occurrences


def inspect_media(archive: zipfile.ZipFile, size: dict) -> list[dict]:
    occurrences = media_occurrences(archive, size)
    result = []
    used_filenames: set[str] = set()
    for name in sorted(
        member for member in archive.namelist()
        if member.startswith("ppt/media/") and Path(member).suffix.lower() in IMAGE_EXTENSIONS
    ):
        data = read_member(archive, name)
        suffix = Path(name).suffix.lower()
        stem = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(name).stem).strip("-._") or "media"
        filename = f"{stem}{suffix}"
        if filename.lower() in used_filenames:
            filename = f"{stem}-{hashlib.sha256(data).hexdigest()[:8]}{suffix}"
        used_filenames.add(filename.lower())
        width, height, alpha = image_dimensions(data, suffix)
        refs = occurrences.get(name, [])
        contexts = Counter(ref["context"] for ref in refs)
        image_ratio = width / height if width and height else None
        slide_ratio = size.get("ratio") or 16 / 9
        slide_aspect_match = bool(
            image_ratio and abs(image_ratio - slide_ratio) / slide_ratio <= 0.04
        )
        small = any(
            ref["geometry"] and ref["geometry"]["areaRatio"] is not None and
            ref["geometry"]["areaRatio"] <= 0.15
            for ref in refs
        )
        near_edge = any(ref["geometry"] and ref["geometry"]["nearEdge"] for ref in refs)
        background_score = 0
        if slide_aspect_match and width and height and width >= 800 and height >= 400:
            background_score += 4
        background_score += contexts["master"] * 4 + contexts["layout"] * 2 + contexts["slide"]
        score = contexts["master"] * 3 + contexts["layout"] * 2
        if len(refs) >= 3:
            score += 1
        if small:
            score += 3
        if near_edge:
            score += 1
        if alpha:
            score += 1
        if width and height and max(width, height) <= 600:
            score += 1
        if slide_aspect_match and width and height and width >= 800:
            score -= 8
        if len(data) > 1024 * 1024:
            score -= 2
        result.append({
            "packagePath": name,
            "filename": filename,
            "extension": suffix,
            "bytes": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "width": width,
            "height": height,
            "aspectRatio": round(image_ratio, 5) if image_ratio else None,
            "slideAspectMatch": slide_aspect_match,
            "hasAlpha": alpha,
            "browserCompatible": suffix in BROWSER_IMAGE_EXTENSIONS,
            "activeContentRisk": suffix == ".svg",
            "occurrences": refs,
            "logoScore": score,
            "backgroundScore": background_score,
            "_data": data,
        })
    return result


def relative_luminance(hex_color: str) -> float:
    channels = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(a: str, b: str) -> float:
    light, dark = sorted((relative_luminance(a), relative_luminance(b)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def is_neutral(hex_color: str) -> bool:
    red, green, blue = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    _, saturation, _ = colorsys.rgb_to_hsv(red, green, blue)
    return saturation < 0.18


def recommended_palette(colors: dict, color_usage: Counter) -> dict:
    explicit = [
        value for value, _ in color_usage.most_common()
        if re.fullmatch(r"#[0-9A-Fa-f]{6}", value)
        and value.upper() not in {"#000000", "#FFFFFF"}
    ]
    chromatic = []
    for value in explicit:
        if is_neutral(value):
            continue
        rgb = tuple(int(value[index:index + 2], 16) for index in (1, 3, 5))
        if all(
            math.sqrt(sum((channel - other_channel) ** 2 for channel, other_channel in zip(rgb, other))) >= 60
            for other in [
                tuple(int(existing[index:index + 2], 16) for index in (1, 3, 5))
                for existing in chromatic
            ]
        ):
            chromatic.append(value.upper())
    neutral = next((value.upper() for value in explicit if is_neutral(value)), None)
    background = colors.get("lt1", "#FFFFFF")
    inverse_text = colors.get("lt1", "#FFFFFF")
    heading_candidates = [
        colors.get("dk2"),
        *reversed(chromatic),
        colors.get("dk1"),
    ]
    heading = next(
        (candidate for candidate in heading_candidates
         if candidate and contrast(candidate, background) >= 4.5),
        colors.get("dk1", "#1F2328"),
    )
    inverse_candidates = [
        colors.get("dk2"),
        *reversed(chromatic),
        colors.get("dk1"),
    ]
    inverse_background = next(
        (candidate for candidate in inverse_candidates
         if candidate and contrast(inverse_text, candidate) >= 4.5),
        colors.get("dk1", "#1F2328"),
    )
    return {
        "background": background,
        "foreground": colors.get("dk1", "#1F2328"),
        "primary": chromatic[0] if chromatic else colors.get("accent1", "#0969DA"),
        "secondary": chromatic[1] if len(chromatic) > 1 else colors.get("accent2", "#1A7F37"),
        "accent": chromatic[2] if len(chromatic) > 2 else colors.get("accent3", "#BF8700"),
        "heading": heading,
        "muted": neutral or colors.get("dk2", "#57606A"),
        "panel": colors.get("lt2", "#F6F8FA"),
        "inverseText": inverse_text,
        "inverseBackground": inverse_background,
        "link": colors.get("hlink", colors.get("accent1", "#0969DA")),
    }


def css_font(value: str, fallback: str) -> str:
    name = re.sub(r"[\x00-\x1f\x7f]", "", value or fallback)
    name = name.replace("\\", "").replace("'", "\\'")[:120]
    return f"'{name}', Arial, sans-serif"


def css_asset_url(theme_name: str, item: dict | None) -> str | None:
    if not item:
        return None
    mime = MIME_TYPES.get(item["extension"])
    data = item.get("_data")
    if mime and data is not None and len(data) <= MAX_EMBED_IMAGE_BYTES:
        encoded = base64.b64encode(data).decode("ascii")
        return f"data:{mime};base64,{encoded}"
    return f"./{theme_name}/assets/{item['filename']}"


def theme_css(
    theme_name: str,
    source_name: str,
    palette: dict,
    fonts: dict,
    size: dict,
    logo: dict | None,
    background_asset: dict | None,
    title_background_asset: dict | None,
    css_imports: list[str],
) -> str:
    background = palette["background"]
    foreground = palette["foreground"]
    primary = palette["primary"]
    secondary = palette["secondary"]
    accent = palette["accent"]
    heading = palette["heading"]
    muted = palette["muted"]
    panel = palette["panel"]
    inverse_text = palette["inverseText"]
    inverse_background = palette["inverseBackground"]
    link = palette["link"]
    heading_font = fonts.get("major", {}).get("latin") or "Aptos Display"
    body_font = fonts.get("minor", {}).get("latin") or "Aptos"
    ratio = size.get("ratio") or 16 / 9
    canvas_height = 720
    canvas_width = round(canvas_height * ratio)
    logo_rule = ""
    if logo:
        logo_path = css_asset_url(theme_name, logo)
        logo_rule = f"""
:root {{
  --brand-logo: url('{logo_path}');
}}

section.brand-logo::after {{
  content: "";
  position: absolute;
  top: 24px;
  right: 32px;
  width: 150px;
  height: 52px;
  background: var(--brand-logo) no-repeat right center / contain;
}}
"""
    background_rule = ""
    if background_asset:
        background_path = css_asset_url(theme_name, background_asset)
        background_rule = f"""
:root {{
  --brand-template-background: url('{background_path}');
}}

section {{
  background-image: var(--brand-template-background);
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
}}

section.template-background {{
  background: var(--brand-template-background) no-repeat center / cover;
}}
"""
    title_background_rule = ""
    if title_background_asset:
        title_path = css_asset_url(theme_name, title_background_asset)
        title_background_rule = f"""
:root {{
  --brand-title-background: url('{title_path}');
}}

section.lead {{
  background: var(--brand-title-background) no-repeat center / cover;
}}
"""

    safe_source_name = re.sub(r"[\r\n]", " ", source_name).replace("*/", "* /")
    import_lines = "\n".join(f"@import '{value}';" for value in css_imports)
    if import_lines:
        import_lines = f"\n{import_lines}"
    return f"""/* Generated from {safe_source_name}. Review visual fidelity before production use. */
/* @theme {theme_name} */
/* @size pptx-template {canvas_width}px {canvas_height}px */
@import 'default';{import_lines}

:root {{
  --brand-background: {background};
  --brand-foreground: {foreground};
  --brand-primary: {primary};
  --brand-secondary: {secondary};
  --brand-accent: {accent};
  --brand-heading: {heading};
  --brand-muted: {muted};
  --brand-panel: {panel};
  --brand-inverse-text: {inverse_text};
  --brand-inverse-background: {inverse_background};
  --brand-link: {link};
  --brand-heading-font: {css_font(heading_font, 'Aptos Display')};
  --brand-body-font: {css_font(body_font, 'Aptos')};
}}

section {{
  color: var(--brand-foreground);
  background: var(--brand-background);
  font-family: var(--brand-body-font);
  padding: 46px 58px;
}}

h1, h2, h3, h4, h5, h6 {{
  color: var(--brand-heading);
  font-family: var(--brand-heading-font);
}}

a {{
  color: var(--brand-link);
}}

strong {{
  color: var(--brand-heading);
}}

section.lead {{
  color: var(--brand-inverse-text);
  background-color: var(--brand-inverse-background);
}}

section.lead h1,
section.lead h2,
section.invert h1,
section.invert h2 {{
  color: var(--brand-inverse-text);
}}

section.invert {{
  color: var(--brand-inverse-text);
  background-color: var(--brand-inverse-background);
  background-image: none;
}}

section.small {{
  font-size: 24px;
}}

section.columns,
div.columns {{
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.2rem;
  align-items: start;
}}

section.columns3,
div.columns3 {{
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  align-items: start;
}}

blockquote,
pre,
table {{
  background: var(--brand-panel);
}}

img[alt~="center"] {{
  display: block;
  margin-inline: auto;
}}

svg[id^="mermaid-"] {{
  max-width: 100%;
  max-height: 500px;
}}
{background_rule}{title_background_rule}{logo_rule}"""


def sample_deck(
    theme_name: str,
    logo: dict | None,
    background_asset: dict | None,
    title_background_asset: dict | None,
) -> str:
    logo_class = " brand-logo" if logo else ""
    background_class = " template-background" if background_asset and not title_background_asset else ""
    logo_note = "\n\nThe extracted logo is applied through the `brand-logo` class." if logo else ""
    return f"""---
marp: true
theme: {theme_name}
size: pptx-template
paginate: true
math: mathjax
---

<!-- _class: lead{background_class}{logo_class} -->
<!-- _paginate: skip -->

# PowerPoint-derived Marp theme

Colors, fonts, dimensions, and reusable media

<!-- Compare this slide with the original PowerPoint title layout.{logo_note} -->

---

## Brand palette

- Primary heading and emphasis
- Secondary supporting color
- Accent for focused callouts
- Panel and background surfaces

<!-- Verify contrast and adjust generated tokens when the source template relies on imagery. -->

---

<!-- _class: columns -->

# Existing slide layouts

## Content

- Existing Marp content remains Markdown
- The generated theme changes presentation, not narrative

## Validation

- Compare representative layouts
- Run overflow and PDF review

---

<!-- _class: invert -->

# Review before rollout

PowerPoint layouts and Marp CSS are different systems

<!-- Treat this output as a faithful starting point, then refine with rendered comparisons. -->
"""


def summary_markdown(report: dict) -> str:
    palette = "\n".join(f"- `{name}`: `{value}`" for name, value in report["colors"]["scheme"].items()) or "- None resolved"
    fonts = report["fonts"]["scheme"]
    logo = report["media"]["autoLogo"]["filename"] if report["media"]["autoLogo"] else "None selected automatically"
    return f"""# PowerPoint Theme Extraction

Source: `{report['source']['path']}`

## Generated files

- Marp theme: `{report['outputs']['themeCss']}`
- Sample deck: `{report['outputs']['sampleDeck']}`
- Machine-readable report: `{report['outputs']['report']}`

## Theme colors

{palette}

## Fonts

- Heading: `{fonts.get('major', {}).get('latin') or 'Not declared'}`
- Body: `{fonts.get('minor', {}).get('latin') or 'Not declared'}`

PowerPoint usually stores font family names, not reusable font files. Confirm
that recipients have the selected fonts or replace them with licensed web or
system-font alternatives.

## Logo candidate

`{logo}`

Logo detection is heuristic. Confirm the selected asset visually.

## Next step

Render `sample.md`, compare it with representative slides from the source
template, refine the CSS, then apply the theme to existing decks with
`apply_marp_theme.py`.
"""


def prepare_output(output_dir: Path, theme_name: str, force: bool) -> tuple[Path, Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    artifact_dir = output_dir / theme_name
    marker = artifact_dir / ".pptx-to-marp-theme.json"
    css_path = output_dir / f"{theme_name}.css"
    if css_path.exists() or artifact_dir.exists():
        if not force:
            raise ValueError(
                f"Output already exists for theme '{theme_name}'. Re-run with --force to replace generated files."
            )
        if not marker.exists():
            raise ValueError(
                f"Refusing to overwrite unrecognized output directory without marker: {artifact_dir}"
            )
        previous = json.loads(marker.read_text(encoding="utf-8"))
        for relative in previous.get("generatedFiles", []):
            candidate = (output_dir / relative).resolve()
            if output_dir.resolve() not in candidate.parents and candidate != output_dir.resolve():
                raise ValueError(f"Unsafe generated path in marker: {relative}")
            if candidate.is_file():
                candidate.unlink()
    (artifact_dir / "assets").mkdir(parents=True, exist_ok=True)
    return artifact_dir, marker, css_path


def build_report(
    source: Path,
    archive: zipfile.ZipFile,
    output_dir: Path,
    theme_name: str,
    css_imports: list[str],
) -> dict:
    colors, fonts, theme_warnings, themes = extract_theme(archive)
    size = presentation_size(archive)
    color_usage, font_usage, usage_warnings = scan_usage(archive)
    media = inspect_media(archive, size)
    palette = recommended_palette(colors, color_usage)
    background_candidates = [
        {key: value for key, value in item.items() if key != "_data"}
        for item in sorted(media, key=lambda item: (-item["backgroundScore"], item["filename"]))
        if item["browserCompatible"]
        and not item["activeContentRisk"]
        and item["backgroundScore"] >= 4
        and (
            item["slideAspectMatch"]
            or any(
                ref["geometry"]
                and ref["geometry"]["areaRatio"] is not None
                and ref["geometry"]["areaRatio"] >= 0.5
                for ref in item["occurrences"]
            )
        )
    ]
    title_background_candidates = [
        {key: value for key, value in item.items() if key != "_data"}
        for item in sorted(media, key=lambda item: (-item["backgroundScore"], item["filename"]))
        if item["browserCompatible"]
        and not item["activeContentRisk"]
        and item["slideAspectMatch"]
        and any(ref["owner"] == "ppt/slides/slide1.xml" for ref in item["occurrences"])
    ]
    logo_candidates = [
        {key: value for key, value in item.items() if key != "_data"}
        for item in sorted(media, key=lambda item: (-item["logoScore"], item["filename"]))
        if item["browserCompatible"]
        and item["logoScore"] >= 3
        and not item["slideAspectMatch"]
        and (
            any(ref["context"] in {"master", "layout"} for ref in item["occurrences"])
            or len(item["occurrences"]) >= 2
        )
    ]
    warnings = theme_warnings + usage_warnings
    if any(item["activeContentRisk"] for item in media):
        warnings.append("SVG media was extracted as active content and was not selected automatically as the theme logo.")
    auto_logo = next(
        (candidate for candidate in logo_candidates if not candidate["activeContentRisk"]),
        None,
    )
    background = palette["background"]
    foreground = palette["foreground"]
    primary = palette["primary"]
    if contrast(foreground, background) < 4.5:
        warnings.append(
            f"Body text contrast is {contrast(foreground, background):.2f}:1; review foreground/background tokens."
        )
    if contrast(primary, background) < 3.0:
        warnings.append(
            f"Primary color contrast is {contrast(primary, background):.2f}:1; use it decoratively or darken it."
        )
    selected_assets = [
        candidate for candidate in (
            auto_logo,
            background_candidates[0] if background_candidates else None,
            title_background_candidates[0] if title_background_candidates else None,
        )
        if candidate
    ]
    for selected in selected_assets:
        if selected["bytes"] > MAX_EMBED_IMAGE_BYTES:
            warnings.append(
                f"{selected['filename']} exceeds the {MAX_EMBED_IMAGE_BYTES} byte CSS embed limit; "
                "generated CSS uses a relative asset URL."
            )
    if contrast(palette["heading"], background) < 4.5:
        warnings.append("Generated heading color does not meet 4.5:1 contrast against the body background.")
    if contrast(palette["inverseText"], palette["inverseBackground"]) < 4.5:
        warnings.append("Generated inverse text/background pair does not meet 4.5:1 contrast.")

    artifact_dir = output_dir / theme_name
    report = {
        "source": {
            "path": source.name,
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "extension": source.suffix.lower(),
        },
        "theme": theme_name,
        "cssImports": css_imports,
        "slideSize": size,
        "colors": {
            "scheme": colors,
            "usage": dict(color_usage.most_common()),
            "recommended": palette,
            "powerPointThemes": themes,
        },
        "fonts": {
            "scheme": fonts,
            "usage": dict(font_usage.most_common()),
            "embeddedFontFiles": sorted(
                name for name in archive.namelist()
                if name.startswith(("ppt/fonts/", "ppt/embeddings/"))
            ),
        },
        "media": {
            "items": [{key: value for key, value in item.items() if key != "_data"} for item in media],
            "logoCandidates": logo_candidates,
            "autoLogo": auto_logo,
            "backgroundCandidates": background_candidates,
            "autoBackground": background_candidates[0] if background_candidates else None,
            "titleBackgroundCandidates": title_background_candidates,
            "autoTitleBackground": title_background_candidates[0] if title_background_candidates else None,
        },
        "outputs": {
            "themeCss": str(Path(f"{theme_name}.css")),
            "sampleDeck": str(Path(theme_name) / "sample.md"),
            "report": str(Path(theme_name) / "theme-report.json"),
            "summary": str(Path(theme_name) / "README.md"),
        },
        "embeddedThemeAssets": [
            selected["filename"] for selected in selected_assets
            if selected["bytes"] <= MAX_EMBED_IMAGE_BYTES and selected["extension"] in MIME_TYPES
        ],
        "warnings": warnings,
        "limitations": [
            "PowerPoint layout geometry is not automatically converted into equivalent Marp CSS.",
            "Vector logos built from PowerPoint shapes are not extracted as standalone images.",
            "EMF and WMF media are extracted but are not browser-compatible Marp assets.",
            "Font family names are extracted; embedded font binaries are not copied or licensed for reuse.",
            "Logo detection is heuristic and requires visual confirmation.",
        ],
    }
    return report


def write_outputs(
    source: Path,
    archive: zipfile.ZipFile,
    output_dir: Path,
    theme_name: str,
    force: bool,
    css_imports: list[str],
) -> dict:
    artifact_dir, marker, css_path = prepare_output(output_dir, theme_name, force)
    report = build_report(source, archive, output_dir, theme_name, css_imports)
    media_by_path = {
        item["packagePath"]: item
        for item in inspect_media(archive, report["slideSize"])
    }
    generated: list[str] = []

    assets_dir = artifact_dir / "assets"
    for item in media_by_path.values():
        destination = assets_dir / item["filename"]
        destination.write_bytes(item["_data"])
        generated.append(str(destination.relative_to(output_dir)))

    def raw_candidate(candidate: dict | None) -> dict | None:
        if not candidate:
            return None
        raw = media_by_path[candidate["packagePath"]]
        return {**candidate, "_data": raw["_data"]}

    logo = raw_candidate(report["media"]["autoLogo"])
    background_asset = raw_candidate(report["media"]["autoBackground"])
    title_background_asset = raw_candidate(report["media"]["autoTitleBackground"])
    css_path.write_text(
        theme_css(
            theme_name,
            source.name,
            report["colors"]["recommended"],
            report["fonts"]["scheme"],
            report["slideSize"],
            logo,
            background_asset,
            title_background_asset,
            css_imports,
        ),
        encoding="utf-8",
    )
    generated.append(str(css_path.relative_to(output_dir)))

    sample_path = artifact_dir / "sample.md"
    sample_path.write_text(
        sample_deck(theme_name, logo, background_asset, title_background_asset),
        encoding="utf-8",
    )
    generated.append(str(sample_path.relative_to(output_dir)))

    report_path = artifact_dir / "theme-report.json"
    report_path.write_text(f"{json.dumps(report, indent=2, ensure_ascii=False)}\n", encoding="utf-8")
    generated.append(str(report_path.relative_to(output_dir)))

    summary_path = artifact_dir / "README.md"
    summary_path.write_text(summary_markdown(report), encoding="utf-8")
    generated.append(str(summary_path.relative_to(output_dir)))

    marker_payload = {
        "schemaVersion": 1,
        "sourceSha256": report["source"]["sha256"],
        "theme": theme_name,
        "generatedFiles": sorted(generated + [str(marker.relative_to(output_dir))]),
    }
    marker.write_text(f"{json.dumps(marker_payload, indent=2)}\n", encoding="utf-8")
    return report


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("template", help="PowerPoint .pptx or .potx template")
    parser.add_argument("--output-dir", default="pptx-theme-output", help="Theme output directory")
    parser.add_argument("--theme-name", help="Marp theme name (defaults to template filename)")
    parser.add_argument("--force", action="store_true", help="Replace files from a prior marked extraction")
    parser.add_argument(
        "--css-import",
        action="append",
        default=[],
        help="Additional HTTPS stylesheet or safe CSS import to preserve (repeatable)",
    )
    parser.add_argument("--json", action="store_true", help="Print the complete JSON report")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    source = Path(args.template)
    if not source.is_file():
        print(f"extract-pptx-theme: file not found: {source}", file=sys.stderr)
        return 2
    if source.suffix.lower() not in {".pptx", ".potx"}:
        print("extract-pptx-theme: input must use .pptx or .potx", file=sys.stderr)
        return 2
    theme_name = validate_theme_name(args.theme_name or slugify(source.stem))
    css_imports = [validate_css_import(value) for value in args.css_import]
    output_dir = Path(args.output_dir)
    try:
        with zipfile.ZipFile(source) as archive:
            validate_archive(archive)
            report = write_outputs(
                source,
                archive,
                output_dir,
                theme_name,
                args.force,
                css_imports,
            )
    except (OSError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        print(f"extract-pptx-theme: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"Theme: {report['outputs']['themeCss']}")
        print(f"Sample: {report['outputs']['sampleDeck']}")
        print(f"Report: {report['outputs']['report']}")
        print(f"Media: {len(report['media']['items'])} image(s)")
        print(f"Logo candidates: {len(report['media']['logoCandidates'])}")
        for warning in report["warnings"]:
            print(f"Warning: {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
