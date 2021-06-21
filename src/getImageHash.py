from __future__ import print_function
import sys
import PIL
import json
import imagehash

from updateImageDominantColor import findDominantMostCommonColorInAnImageFile


def main(wallpaperFilePath):
    wallpaperFile = PIL.Image.open(wallpaperFilePath)

    pHash = imagehash.phash(wallpaperFile)
    # print('pHash: ', pHash)
    wHash = imagehash.whash(wallpaperFile)
    # print('wHash: ', wHash)
    aHash = imagehash.average_hash(wallpaperFile)
    # print('aHash: ', aHash)
    dHash = imagehash.dhash(wallpaperFile)
    # print('dHash: ', dHash)

    dominant_color = findDominantMostCommonColorInAnImageFile(
        wallpaperFile)

    return [str(pHash), str(wHash), str(aHash), str(dHash), dominant_color]
    # print(pHash, wHash, aHash, dHash, dominant_color)


if __name__ == "__main__":
    [pHash, wHash, aHash, dHash, dominant_color] = main(sys.argv[1])
    # [pHash, wHash, aHash, dHash, dominant_color] = main('/Users/tony/Playground/bing-wallpaper-robot/docs/thumbs/ddeefc7d40fc3a64cd3b6b28800b5bfa.256.jpg')
    resultJSON = {
        'pHash': pHash,
        'wHash': wHash,
        'aHash': aHash,
        'dHash': dHash,
        'dominant_color': dominant_color
    }

    print(json.dumps(resultJSON, sort_keys=True))
