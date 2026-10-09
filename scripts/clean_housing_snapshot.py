"""Remove repeated floating share controls from the screenshot's blank margin."""
import base64
from pathlib import Path
from PIL import Image, ImageChops
path = Path("projects/assets/housing-affordability/publication-snapshot.png")
with Image.open(path) as im:
    original = im.convert("RGB")
assert original.size == (2560, 21322), "Review margin coordinates if snapshot changes"
cleaned = original.copy()
cleaned.paste("white", (2440, 400, 2560, 20616))
assert ImageChops.difference(original.crop((0, 0, 2440, 21322)), cleaned.crop((0, 0, 2440, 21322))).getbbox() is None
if ImageChops.difference(original, cleaned).getbbox():
    cleaned.save(path)
    path.with_suffix(".png.b64").write_text(base64.b64encode(path.read_bytes()).decode("ascii") + "\n")
