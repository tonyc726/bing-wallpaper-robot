from __future__ import print_function
import sys
import json
import numpy as np
from PIL import Image


def computeColorHist(imagePath, bins=16):
    """
    Compute the RGB color histogram of an image.
    Divides each RGB channel into 'bins' intervals, producing a bins^3 dimensional histogram.
    Returns a normalized histogram array as a JSON list.
    """
    img = Image.open(imagePath).convert('RGB')
    img = img.resize((64, 64), Image.LANCZOS)
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

    imagePath = sys.argv[1]
    try:
        colorHist = computeColorHist(imagePath)
        print(json.dumps({"colorHist": colorHist}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
