from __future__ import print_function
import os
import io
import re
import sqlite3
import PIL
import imagehash
import requests
import base64

from updateImageDominantColor import findDominantMostCommonColorInAnImage


def imgThumbUrl(file_name, width=128):
    return 'https://cn.bing.com/th?id=' + \
        file_name + '_UHD.jpg&w=' + str(width) + '&c=1'


def base64_to_image(base64_str):
    base64_data = re.sub('^data:image/.+;base64,', '', base64_str)
    byte_data = base64.b64decode(base64_data)
    image_data = io.BytesIO(byte_data)
    img = PIL.Image.open(image_data)
    return img


def imgRequestToBase64(img_request):
    return ("data:%s;base64,%s" % (img_request.headers['Content-Type'], str(base64.b64encode(img_request.content).decode("utf-8"))))


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

    updateSQL = '''UPDATE wallpaper SET aHash = ?, pHash = ?, dHash = ?, wHash = ?, hashImg = ?, dominantColor = ? WHERE id = ?'''

    for wallpaperIndex, wallpaper in enumerate(wallpapersList):
        wallpaperId = wallpaper[0]
        wallpaperFileName = wallpaper[1]
        wallpaper_aHash = wallpaper[13]
        wallpaper_pHash = wallpaper[14]
        wallpaper_dHash = wallpaper[15]
        wallpaper_wHash = wallpaper[16]
        wallpaper_hashImg = wallpaper[17]

        if not wallpaper_aHash or not wallpaper_pHash or not wallpaper_dHash or not wallpaper_wHash or not wallpaper_hashImg:
            print(('[%s/%s]: 正在处理"%s"，记录ID: "%s"') % (wallpaperIndex + 1,
                                                      wallpapersListLength, wallpaperFileName, wallpaperId))
            wallpaperRequestUrl = imgThumbUrl(wallpaperFileName, 128)
            wallpaperRequestStream = requests.get(
                wallpaperRequestUrl, stream=True)

            if wallpaperRequestStream.status_code == 200:
                wallpaperFileBase64 = imgRequestToBase64(
                    wallpaperRequestStream)
                wallpaperFile = base64_to_image(wallpaperFileBase64)

                pHash = imagehash.phash(wallpaperFile)
                # print('pHash: ', pHash)
                wHash = imagehash.whash(wallpaperFile)
                # print('wHash: ', wHash)
                aHash = imagehash.average_hash(wallpaperFile)
                # print('aHash: ', aHash)
                dHash = imagehash.dhash(wallpaperFile)
                # print('dHash: ', dHash)

                dominant_color = findDominantMostCommonColorInAnImage(
                    wallpaperFileBase64)

                cur.execute(updateSQL, (str(aHash), str(pHash),
                            str(dHash), str(wHash), wallpaperFileBase64, str(dominant_color), wallpaperId))

                con.commit()

                print(('[Success] 记录"%s"处理成功，更新数据aHash("%s"), pHash("%s"), dHash("%s"), wHash("%s");') % (
                    wallpaperFileName, str(aHash), str(pHash), str(dHash), str(wHash)))
            else:
                print(('[Error] get %s is failed. %s') %
                      (wallpaperFileName, wallpaperRequestStream.reason))
        else:
            print(('[%s/%s]: 记录"%s"，记录ID: "%s" 已经处理') % (wallpaperIndex + 1,
                                                         wallpapersListLength, wallpaperFileName, wallpaperId))

print(('数据处理完成.'))
