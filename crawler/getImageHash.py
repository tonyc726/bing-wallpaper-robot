import json
import sys

import imagehash
import PIL.Image


def compute_hashes(image_path: str) -> dict[str, str]:
    """Compute 4 perceptual image hashes: pHash, wHash, aHash, dHash."""
    image = PIL.Image.open(image_path)

    p_hash = str(imagehash.phash(image))
    w_hash = str(imagehash.whash(image))
    a_hash = str(imagehash.average_hash(image))
    d_hash = str(imagehash.dhash(image))

    return {
        "aHash": a_hash,
        "dHash": d_hash,
        "pHash": p_hash,
        "wHash": w_hash,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "image path required"}))
        sys.exit(1)

    try:
        result = compute_hashes(sys.argv[1])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
