import json
import sys

import numpy as np
from PIL import Image


def compute_color_hist(image_path: str, bins: int = 16) -> list[float]:
    """Compute RGB color histogram with bins^3 dimensions, normalized."""
    with Image.open(image_path) as img:
        img = img.convert("RGB").resize((64, 64), Image.LANCZOS)
        pixels = np.array(img).reshape(-1, 3)

    hist, _ = np.histogramdd(
        pixels,
        bins=bins,
        range=[(0, 255)] * 3,
    )

    hist = hist.flatten().astype(np.float64)
    total = hist.sum()
    if total > 0:
        hist = hist / total

    return hist.tolist()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "image path required"}))
        sys.exit(1)

    try:
        color_hist = compute_color_hist(sys.argv[1])
        print(json.dumps({"colorHist": color_hist}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
