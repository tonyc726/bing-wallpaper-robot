from __future__ import print_function
import os
import io
import re
import sqlite3
from PIL import Image
import base64
# https://stackoverflow.com/questions/3241929/python-find-dominant-most-common-color-in-an-image
import binascii
import struct
import numpy as np
import scipy
import scipy.misc
import scipy.cluster


def base64_to_image(base64_str):
    base64_data = re.sub('^data:image/.+;base64,', '', base64_str)
    byte_data = base64.b64decode(base64_data)
    image_data = io.BytesIO(byte_data)
    img = Image.open(image_data)
    return img


def findDominantMostCommonColorInAnImage(img_base64):
    NUM_CLUSTERS = 5
    im = base64_to_image(img_base64)
    ar = np.asarray(im)
    shape = ar.shape
    ar = ar.reshape(scipy.product(shape[:2]), shape[2]).astype(float)
    # print('finding clusters')
    codes, dist = scipy.cluster.vq.kmeans(ar, NUM_CLUSTERS)
    # print('cluster centres:\n', codes)
    vecs, dist = scipy.cluster.vq.vq(ar, codes)         # assign codes
    counts, bins = scipy.histogram(vecs, len(codes))    # count occurrences
    index_max = scipy.argmax(counts)                    # find most frequent
    peak = codes[index_max]
    colour = binascii.hexlify(bytearray(int(c) for c in peak)).decode('ascii')
    return colour


def findDominantMostCommonColorInAnImageFile(image):
    NUM_CLUSTERS = 5
    ar = np.asarray(image)
    shape = ar.shape
    ar = ar.reshape(scipy.product(shape[:2]), shape[2]).astype(float)
    # print('finding clusters')
    codes, dist = scipy.cluster.vq.kmeans(ar, NUM_CLUSTERS)
    # print('cluster centres:\n', codes)
    vecs, dist = scipy.cluster.vq.vq(ar, codes)         # assign codes
    counts, bins = scipy.histogram(vecs, len(codes))    # count occurrences
    index_max = scipy.argmax(counts)                    # find most frequent
    peak = codes[index_max]
    colour = binascii.hexlify(bytearray(int(c) for c in peak)).decode('ascii')
    return colour

if __name__ == "__main__":
    currentFilePath = os.path.dirname(os.path.abspath(__file__))
    dbFilePath = os.path.join(
        currentFilePath, '../database/bing-wallpaper.sqlite')

    con = sqlite3.connect(dbFilePath)
    cur = con.cursor()

    wallpapers = cur.execute('SELECT * FROM wallpaper ORDER BY date')

    wallpapersList = wallpapers.fetchall()
    wallpapersListLength = len(wallpapersList)

    print(('数据读取完成，共 %s 条记录.') % (wallpapersListLength))

    updateSQL = '''UPDATE wallpaper SET dominantColor = ? WHERE id = ?'''

    for wallpaperIndex, wallpaper in enumerate(wallpapersList):
        wallpaperId = wallpaper[0]
        wallpaperFileName = wallpaper[1]
        wallpaper_hashImg = wallpaper[17]

        if not wallpaper_hashImg:
            print(('[%s/%s]: 记录"%s"，记录ID: "%s" 暂无图片数据，无法获取主色调') % (wallpaperIndex + 1,
                                                                   wallpapersListLength, wallpaperFileName, wallpaperId))
        else:
            print(('[%s/%s]: 正在处理"%s"，记录ID: "%s"') % (wallpaperIndex + 1,
                                                      wallpapersListLength, wallpaperFileName, wallpaperId))

            dominant_color = findDominantMostCommonColorInAnImage(
                wallpaper_hashImg)

            if not dominant_color:
                print(('[Error] can not find %s dominant color.') %
                      (wallpaperFileName))
            else:
                cur.execute(updateSQL, (str(dominant_color), wallpaperId))

                con.commit()

                print(('[Success] 记录"%s"处理成功，更新图片主色为: #%s') % (
                    wallpaperFileName, dominant_color))

