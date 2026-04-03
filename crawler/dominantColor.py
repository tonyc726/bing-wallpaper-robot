import binascii
import json
import sys
from collections import Counter

import numpy as np
import scipy.cluster.vq
from PIL import Image


def find_dominant_color(image: Image.Image, num_clusters: int = 5) -> str:
    """Extract the dominant color from an image using k-means clustering."""
    ar = np.asarray(image)
    shape = ar.shape
    ar = ar.reshape(np.prod(shape[:2]), shape[2]).astype(float)

    codes, _ = scipy.cluster.vq.kmeans(ar, num_clusters)
    vecs, _ = scipy.cluster.vq.vq(ar, codes)

    counts = Counter(vecs)
    index_max = counts.most_common(1)[0][0]
    peak = codes[index_max]
    colour = binascii.hexlify(bytearray(int(c) for c in peak)).decode("ascii")
    return colour


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "image path required"}))
        sys.exit(1)

    try:
        with Image.open(sys.argv[1]) as img:
            color = find_dominant_color(img)
        print(json.dumps({"dominantColor": color}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
