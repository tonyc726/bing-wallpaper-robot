from __future__ import print_function
import sys
import json
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim


def computeSSIM(imagePathA, imagePathB):
    """
    Compute SSIM (Structural Similarity Index) between two images.
    Returns a score between 0 and 1, where 1 means identical.
    Also returns MAE (Mean Absolute Error) as a supplementary metric.
    """
    imgA = Image.open(imagePathA).convert('L')
    imgB = Image.open(imagePathB).convert('L')

    maxSize = max(imgA.size[0], imgA.size[1], imgB.size[0], imgB.size[1])
    size = max(maxSize, 256)
    imgA = imgA.resize((size, size), Image.LANCZOS)
    imgB = imgB.resize((size, size), Image.LANCZOS)

    arrA = np.array(imgA)
    arrB = np.array(imgB)

    score = ssim(arrA, arrB, data_range=255)
    mae = float(np.mean(np.abs(arrA.astype(float) - arrB.astype(float))))

    return float(score), mae


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "two image paths required"}))
        sys.exit(1)

    try:
        score, mae = computeSSIM(sys.argv[1], sys.argv[2])
        print(json.dumps({"ssim": score, "mae": mae}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
