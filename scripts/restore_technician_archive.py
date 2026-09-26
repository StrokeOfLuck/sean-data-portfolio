"""Restore the preserved Technician asset. Run from the repo root: python -m scripts.restore_technician_archive."""

from pathlib import Path
import base64
import gzip
import hashlib

parts = [
    Path("projects/assets/park-it-here/archive-gzip/part-1.b64"),
    Path("projects/assets/park-it-here/archive-gzip/part-2.b64"),
    Path("projects/assets/park-it-here/archive-gzip/part-3.b64"),
    Path("projects/assets/park-it-here/archive-gzip/part-4.b64"),
]
encoded = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
compressed = base64.b64decode(encoded, validate=True)

expected_gzip = "087391614c7ee362eb70e7c1d4fd20955868aeacb2ac3e233df5108a2d450950"
actual_gzip = hashlib.sha256(compressed).hexdigest()
if actual_gzip != expected_gzip:
    raise SystemExit(f"Technician archive gzip hash mismatch: {actual_gzip}")

html = gzip.decompress(compressed)
expected_html = "ba6a840d57e05afd41460a5962317d284d2c8582be52cd92ea14e38d8a36cd2b"
actual_html = hashlib.sha256(html).hexdigest()
if actual_html != expected_html:
    raise SystemExit(f"Technician archive HTML hash mismatch: {actual_html}")

freeze_source = Path("projects/assets/park-it-here/technician-freeze.css.gz.b64")
freeze_compressed = base64.b64decode(freeze_source.read_text(encoding="utf-8").strip(), validate=True)
expected_freeze_gzip = "9be087ae08bc4624dc8fb808ff3d2fb40856143aa8e12add56f6a925b37eaafb"
if hashlib.sha256(freeze_compressed).hexdigest() != expected_freeze_gzip:
    raise SystemExit("Technician captured CSS gzip hash mismatch")

freeze_css = gzip.decompress(freeze_compressed)
expected_freeze_css = "c75b6cf708ee00ce599dc6572b10b4d6560ac53a1272012628ac3e50d49f977a"
if hashlib.sha256(freeze_css).hexdigest() != expected_freeze_css:
    raise SystemExit("Technician captured CSS hash mismatch")

freeze_target = Path("projects/assets/park-it-here/technician-freeze.css")
freeze_target.write_bytes(freeze_css)

stylesheet = b'\n<link rel="stylesheet" href="technician-freeze.css" data-archive-frozen-layout="1"/>\n'
for name, marker in (
    ("technician-exact.css", "archive-exact-styles"),
    ("technician-final-tweaks.css", "archive-final-tweaks"),
    ("technician-foldable-mobile.css", "archive-foldable-mobile"),
):
    revision = hashlib.sha256((freeze_target.parent / name).read_bytes()).hexdigest()[:12]
    stylesheet += f'<link rel="stylesheet" href="{name}?v={revision}" data-{marker}="1"/>\n'.encode()
portfolio_overrides = Path(__file__).with_name("technician_archive_overrides.html").read_text(encoding="utf-8").encode("utf-8")
if b"</head>" not in html:
    raise SystemExit("Preserved Technician archive is missing </head>")
html = html.replace(b"</head>", stylesheet + portfolio_overrides + b"</head>", 1)

target = Path("projects/assets/park-it-here/park-it-here-archive.html")
from scripts.localize_technician import localize
html = localize(html.decode("utf-8")).encode("utf-8")
target.write_bytes(html)
print(f"Restored {target} ({len(html):,} bytes) with captured layout CSS")
