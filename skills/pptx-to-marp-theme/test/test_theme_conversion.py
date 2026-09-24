from __future__ import annotations

import base64
import importlib.util
import json
import struct
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
EXTRACTOR = SKILL_ROOT / "scripts" / "extract_pptx_theme.py"
APPLIER = SKILL_ROOT / "scripts" / "apply_marp_theme.py"
PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/gL+Y2f7WQAAAABJRU5ErkJggg=="
)

MODULE_SPEC = importlib.util.spec_from_file_location("pptx_theme_extractor", EXTRACTOR)
assert MODULE_SPEC and MODULE_SPEC.loader
EXTRACTOR_MODULE = importlib.util.module_from_spec(MODULE_SPEC)
MODULE_SPEC.loader.exec_module(EXTRACTOR_MODULE)
APPLIER_SPEC = importlib.util.spec_from_file_location("marp_theme_applier", APPLIER)
assert APPLIER_SPEC and APPLIER_SPEC.loader
APPLIER_MODULE = importlib.util.module_from_spec(APPLIER_SPEC)
APPLIER_SPEC.loader.exec_module(APPLIER_MODULE)


THEME_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Brand">
  <a:themeElements>
    <a:clrScheme name="Brand">
      <a:dk1><a:srgbClr val="172B4D"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="42526E"/></a:dk2>
      <a:lt2><a:srgbClr val="F4F5F7"/></a:lt2>
      <a:accent1><a:srgbClr val="0052CC"/></a:accent1>
      <a:accent2><a:srgbClr val="36B37E"/></a:accent2>
      <a:accent3><a:srgbClr val="FFAB00"/></a:accent3>
      <a:accent4><a:srgbClr val="6554C0"/></a:accent4>
      <a:accent5><a:srgbClr val="00B8D9"/></a:accent5>
      <a:accent6><a:srgbClr val="FF5630"/></a:accent6>
      <a:hlink><a:srgbClr val="0065FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="5243AA"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Brand Fonts">
      <a:majorFont>
        <a:latin typeface="Aptos Display"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Aptos"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Brand Format"/>
  </a:themeElements>
</a:theme>
"""

PRESENTATION_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
</p:presentation>
"""

MASTER_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:pic>
      <p:blipFill><a:blip r:embed="rIdLogo"/></p:blipFill>
      <p:spPr><a:xfrm><a:off x="10800000" y="200000"/><a:ext cx="900000" cy="400000"/></a:xfrm></p:spPr>
    </p:pic>
  </p:spTree></p:cSld>
</p:sldMaster>
"""

MASTER_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLogo"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
    Target="../media/image1.png"/>
</Relationships>
"""


class ThemeConversionTests(unittest.TestCase):
    def make_template(self, root: Path) -> Path:
        template = root / "conference.potx"
        with zipfile.ZipFile(template, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("ppt/presentation.xml", PRESENTATION_XML)
            archive.writestr("ppt/theme/theme1.xml", THEME_XML)
            archive.writestr("ppt/slideMasters/slideMaster1.xml", MASTER_XML)
            archive.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", MASTER_RELS)
            archive.writestr("ppt/media/image1.png", PNG_1X1)
        return template

    def test_extracts_theme_and_applies_it_to_existing_deck(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            template = self.make_template(root)
            output = root / "themes"
            result = subprocess.run(
                [
                    sys.executable,
                    str(EXTRACTOR),
                    str(template),
                    "--output-dir",
                    str(output),
                    "--theme-name",
                    "conference",
                    "--json",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            report = json.loads(result.stdout)
            self.assertEqual(report["colors"]["scheme"]["accent1"], "#0052CC")
            self.assertEqual(report["fonts"]["scheme"]["major"]["latin"], "Aptos Display")
            self.assertAlmostEqual(report["slideSize"]["ratio"], 16 / 9, places=3)
            self.assertEqual(report["media"]["logoCandidates"][0]["filename"], "image1.png")

            css_path = output / "conference.css"
            css = css_path.read_text(encoding="utf-8")
            self.assertIn("/* @theme conference */", css)
            self.assertIn("--brand-primary: #0052CC", css)
            self.assertIn("'Aptos Display'", css)
            self.assertIn("data:image/png;base64,", css)
            self.assertTrue((output / "conference" / "assets" / "image1.png").is_file())
            self.assertTrue((output / "conference" / "sample.md").is_file())

            deck = root / "deck.md"
            deck.write_text(
                "---\nmarp: true\ntheme: old\n---\n\n"
                "<!-- _class: columns custom-layout -->\n"
                '<i class="fa-brands fa-github"></i>\n'
                '<div class="mermaid">flowchart LR</div>\n'
                "# Existing content\n",
                encoding="utf-8",
            )
            preview = subprocess.run(
                [
                    sys.executable,
                    str(APPLIER),
                    str(css_path),
                    str(deck),
                    "--use-template-size",
                    "--json",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(preview.returncode, 0, preview.stderr)
            preview_payload = json.loads(preview.stdout)
            self.assertEqual(preview_payload["mode"], "dry-run")
            self.assertEqual(preview_payload["results"][0]["classes"]["unsupported"], ["custom-layout"])
            self.assertEqual(len(preview_payload["results"][0]["externalDependencies"]), 2)
            self.assertIn("theme: old", deck.read_text(encoding="utf-8"))

            applied = subprocess.run(
                [
                    sys.executable,
                    str(APPLIER),
                    str(css_path),
                    str(deck),
                    "--use-template-size",
                    "--write",
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(applied.returncode, 0, applied.stderr)
            updated = deck.read_text(encoding="utf-8")
            self.assertIn("theme: conference", updated)
            self.assertIn("size: pptx-template", updated)
            self.assertIn("# Existing content", updated)

    def test_streaming_limit_rejects_forged_uncompressed_size(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive_path = root / "forged.pptx"
            member = "ppt/media/image1.png"
            payload = b"A" * 65536
            with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(member, payload)

            data = bytearray(archive_path.read_bytes())
            local = data.index(b"PK\x03\x04")
            central = data.index(b"PK\x01\x02")
            data[local + 22:local + 26] = struct.pack("<I", 10)
            data[central + 24:central + 28] = struct.pack("<I", 10)
            archive_path.write_bytes(data)

            original_limit = EXTRACTOR_MODULE.MAX_MEMBER_BYTES
            EXTRACTOR_MODULE.MAX_MEMBER_BYTES = 1024
            try:
                with zipfile.ZipFile(archive_path) as archive:
                    with self.assertRaisesRegex(
                        ValueError,
                        "while decompressing|Cannot safely read archive member",
                    ):
                        EXTRACTOR_MODULE.read_member(archive, member)
            finally:
                EXTRACTOR_MODULE.MAX_MEMBER_BYTES = original_limit

    def test_frontmatter_updates_preserve_bom_newlines_and_slide_body(self) -> None:
        body = "\r\n# Original\r\n\r\n<!-- Notes\nwith mixed newlines -->\r\n"
        source = "\ufeff---\r\nmarp: true\r\ntheme: >-\r\n  old-theme\r\nstyle: |\r\n  section { color: red; }\r\n---\r\n" + body
        updated, _ = APPLIER_MODULE.update_deck(source, "conference", None)
        self.assertTrue(updated.startswith("\ufeff---\r\n"))
        self.assertIn("theme: conference\r\nstyle: |\r\n", updated)
        self.assertNotIn("old-theme", updated)
        self.assertEqual(updated.split("---\r\n", 2)[2], body)
        with self.assertRaisesRegex(ValueError, "duplicate"):
            APPLIER_MODULE.update_deck("---\ntheme: old\n\"theme\": also-old\n---\n# Slide", "conference", None)
        literal, _ = APPLIER_MODULE.update_deck("---\ntheme: |2-\n  old\n---\n# Slide\n", "conference", None)
        self.assertNotIn("  old", literal)
        with self.assertRaisesRegex(ValueError, "multiline quoted"):
            APPLIER_MODULE.update_deck('---\ntheme: "old\n  theme"\n---\n# Slide\n', "conference", None)

    def test_cli_preserves_crlf_and_validates_all_decks_before_writing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            css = root / "conference.css"
            css.write_text("/* @theme conference */\n", encoding="utf-8")
            valid = root / "valid.md"
            original = b"---\r\nmarp: true\r\ntheme: old\r\n---\r\n# Content\r\n"
            valid.write_bytes(original)
            invalid = root / "invalid.md"
            invalid.write_text("---\ntheme: old\n", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(APPLIER), str(css), str(valid), str(invalid), "--write"],
                capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(valid.read_bytes(), original)
            result = subprocess.run(
                [sys.executable, str(APPLIER), str(css), str(valid), "--write"],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(valid.read_bytes(), original.replace(b"theme: old", b"theme: conference"))

    def test_force_preserves_prior_output_when_new_input_is_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            template = self.make_template(root)
            output = root / "themes"
            with zipfile.ZipFile(template) as archive:
                EXTRACTOR_MODULE.write_outputs(template, archive, output, "conference", False, [])
                contents = {name: archive.read(name) for name in archive.namelist()}
            previous = {p.relative_to(output): p.read_bytes() for p in output.rglob("*") if p.is_file()}
            invalid = root / "invalid.potx"
            contents["ppt/theme/theme1.xml"] = b"<broken"
            with zipfile.ZipFile(invalid, "w") as archive:
                for name, data in contents.items():
                    archive.writestr(name, data)
            with zipfile.ZipFile(invalid) as archive:
                with self.assertRaisesRegex(ValueError, "Cannot parse"):
                    EXTRACTOR_MODULE.write_outputs(invalid, archive, output, "conference", True, [])
            self.assertEqual(previous, {p.relative_to(output): p.read_bytes() for p in output.rglob("*") if p.is_file()})

    def test_generated_paths_are_portable_and_force_reuses_the_marker(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            template = self.make_template(root)
            output = root / "themes"
            with zipfile.ZipFile(template) as archive:
                report = EXTRACTOR_MODULE.write_outputs(template, archive, output, "conference", False, [])
            self.assertEqual(report["outputs"], {
                "themeCss": "conference.css",
                "sampleDeck": "conference/sample.md",
                "report": "conference/theme-report.json",
                "summary": "conference/README.md",
            })
            marker = output / "conference" / ".pptx-to-marp-theme.json"
            recorded = json.loads(marker.read_text(encoding="utf-8"))
            expected = sorted([
                "conference.css",
                "conference/.pptx-to-marp-theme.json",
                "conference/README.md",
                "conference/assets/image1.png",
                "conference/sample.md",
                "conference/theme-report.json",
            ])
            self.assertEqual(recorded["generatedFiles"], expected)
            prior = {name: (output / name).read_bytes() for name in expected}
            stale = output / "conference" / "assets" / "old.png"
            stale.write_bytes(PNG_1X1)
            recorded["generatedFiles"].append("conference/assets/old.png")
            marker.write_text(json.dumps(recorded), encoding="utf-8")
            with zipfile.ZipFile(template) as archive:
                EXTRACTOR_MODULE.write_outputs(template, archive, output, "conference", True, [])
            self.assertFalse(stale.exists())
            self.assertEqual({name: (output / name).read_bytes() for name in expected}, prior)
            with self.assertRaisesRegex(ValueError, "Unsafe generated path"):
                EXTRACTOR_MODULE.managed_output_path(output, "conference", "conference\\sample.md")

    def test_force_rejects_cross_theme_marker_paths_and_unrecorded_files(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            template = self.make_template(root)
            output = root / "themes"
            with zipfile.ZipFile(template) as archive:
                EXTRACTOR_MODULE.write_outputs(template, archive, output, "conference", False, [])
            marker = output / "conference" / ".pptx-to-marp-theme.json"
            recorded = json.loads(marker.read_text(encoding="utf-8"))
            unrelated = output / "other.css"
            unrelated.write_text("Keep me", encoding="utf-8")
            recorded["generatedFiles"].append("other.css")
            marker.write_text(json.dumps(recorded), encoding="utf-8")
            with zipfile.ZipFile(template) as archive:
                with self.assertRaisesRegex(ValueError, "Unsafe generated path"):
                    EXTRACTOR_MODULE.write_outputs(template, archive, output, "conference", True, [])
            self.assertEqual(unrelated.read_text(encoding="utf-8"), "Keep me")
            recorded["generatedFiles"].remove("other.css")
            recorded["generatedFiles"].remove("conference.css")
            marker.write_text(json.dumps(recorded), encoding="utf-8")
            with zipfile.ZipFile(template) as archive:
                with self.assertRaisesRegex(ValueError, "unrecorded output"):
                    EXTRACTOR_MODULE.write_outputs(template, archive, output, "conference", True, [])

    def test_extraction_rejects_unsafe_imports_and_resolves_linear_colors(self) -> None:
        for url in ["http://example.com/font.css", "//example.com/font.css", "data:text/css,body{}", "https://user:password@example.com/a.css", "icons\\27.css"]:
            with self.assertRaises(ValueError):
                EXTRACTOR_MODULE.validate_css_import(url)
        self.assertEqual(EXTRACTOR_MODULE.validate_css_import("icons.css"), "icons.css")
        node = EXTRACTOR_MODULE.ET.fromstring('<a:scrgbClr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" r="50000" g="50000" b="50000"/>')
        self.assertEqual(EXTRACTOR_MODULE.color_from_node(node), "BCBCBC")


if __name__ == "__main__":
    unittest.main()
