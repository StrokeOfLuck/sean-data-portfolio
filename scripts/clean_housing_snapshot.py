"""Remove capture cursors from the empty margin of the archived screenshot."""
import base64
from pathlib import Path
from PIL import Image, ImageChops

path = Path("projects/assets/housing-affordability/publication-snapshot.png")
with Image.open(path) as source:
    original = source.convert("RGB")
assert original.size == (1280, 11029), "Snapshot changed; review cursor locations before cleaning"
cleaned = original.copy()
# Cursor and blue halo locations observed in the stitched capture. All boxes
# are in the empty right margin, outside article text, graphics and footer.
centers = [396 + 810 * i for i in range(12)] + [10099, 10499]
for cy in centers:
    cleaned.paste((255, 255, 255), (1120, cy - 45, 1250, cy + 46))
assert ImageChops.difference(original.crop((0, 0, 1120, 11029)), cleaned.crop((0, 0, 1120, 11029))).getbbox() is None
if ImageChops.difference(original, cleaned).getbbox():
    cleaned.save(path)
    path.with_suffix(".png.b64").write_text(base64.b64encode(path.read_bytes()).decode("ascii") + "\n")
    print("Removed cursor artifacts; article pixels and dimensions unchanged")
else:
    print("Snapshot already clean")
