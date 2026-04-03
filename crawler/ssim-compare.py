import json
import sys

import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim


def compute_ssim(path_a: str, path_b: str) -> tuple[float, float]:
    """
    Compute SSIM (Structural Similarity Index) between two images.
    Returns (ssim_score, mae) — ssim_score in [0, 1], lower mae = more similar.
    """
    with Image.open(path_a) as img_a, Image.open(path_b) as img_b:
        img_a = img_a.convert("L")
        img_b = img_b.convert("L")

        max_dim = max(*img_a.size, *img_b.size)
        size = max(max_dim, 256)
        img_a = img_a.resize((size, size), Image.LANCZOS)
        img_b = img_b.resize((size, size), Image.LANCZOS)

        arr_a = np.array(img_a)
        arr_b = np.array(img_b)

        score = ssim(arr_a, arr_b, data_range=255)
        mae = float(np.mean(np.abs(arr_a.astype(float) - arr_b.astype(float))))

    return float(score), mae


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "two image paths required"}))
        sys.exit(1)

    try:
        score, mae = compute_ssim(sys.argv[1], sys.argv[2])
        print(json.dumps({"ssim": score, "mae": mae}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
