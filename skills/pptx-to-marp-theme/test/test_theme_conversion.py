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


if __name__ == "__main__":
    unittest.main()
