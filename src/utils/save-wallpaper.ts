import { merge, pick, get } from 'lodash';
import { Wallpaper } from '../models';
import langEnum from './lang-enum';
import transfromFilenameToHashId from './transfrom-filename-to-hash-id';
import transfromFilenameFromUrlbase from './transfrom-filename-from-urlbase';
import transfromMetadataFromData from './transfrom-metadata-from-data';

/**
 * 保存 Bing壁纸 数据
 * @doc https://typeorm.io/#/repository-api
 *
 * @param {Object} wallpaperRepository
 * @param {Object} wallpaper
 * @param {Boolean} isUpdate
 *
 * @returns {Promise} 返回一个整数
 *
 */
export default (wallpaperRepository: any, wallpaper: any, isUpdate = false): Promise<any> =>
  new Promise((resolve, reject) => {
    const filename = isUpdate ? wallpaper.filename : transfromFilenameFromUrlbase(wallpaper.urlbase);
    const id = isUpdate ? wallpaper.id : transfromFilenameToHashId(filename);
    const [description, address, copyright] = isUpdate
      ? [wallpaper.description, wallpaper.address, wallpaper.copyright]
      : transfromMetadataFromData(wallpaper.copyright);

    const newWallpaper = merge(
      new Wallpaper(),
      {
        filename,
        id,
        title: get(wallpaper, ['title']),
        description,
        address,
        copyright,
        lang: langEnum['zh-CN'],
        date: isUpdate ? get(wallpaper, ['date']) : get(wallpaper, ['startdate']),
        responseTxt: isUpdate
          ? get(wallpaper, ['responseTxt'])
          : Buffer.from(get(wallpaper, ['copyright']), 'utf8').toString('base64'),
      },
      pick(wallpaper, ['imagekitFileId', 'imagekitFileName', 'imagekitFileHeight', 'imagekitFileWidth']),
    );

    wallpaperRepository
      .save(newWallpaper)
      .then((saveWallpaper: any) => {
        resolve(saveWallpaper);
      })
      .catch((error: any) => {
        reject(error);
      });
  });
