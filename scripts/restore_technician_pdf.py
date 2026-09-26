"""Restore the preserved Technician asset. Run from the repo root: python -m scripts.restore_technician_pdf."""

from pathlib import Path
import base64
import re

source = Path("projects/assets/park-it-here/park-it-here-sean-ryan.pdf.b64")
target = Path("projects/assets/park-it-here/park-it-here-sean-ryan.pdf")

encoded = re.sub(r"[^A-Za-z0-9+/=]", "", source.read_text(encoding="utf-8"))
encoded = encoded.rstrip("=")
encoded += "=" * (-len(encoded) % 4)
decoded = base64.b64decode(encoded, validate=False)

if not decoded.startswith(b"%PDF"):
    raise SystemExit("Restored asset is not a PDF")

target.write_bytes(decoded)
print(f"Restored {target} ({len(decoded):,} bytes)")
