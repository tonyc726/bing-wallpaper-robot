import { merge, pick, get } from 'lodash';
import { Wallpaper } from '../models';
import langEnum from './lang-enum';
import transformFilenameToHashId from './transform-filename-to-hash-id';
import transformFilenameFromUrlbase from './transform-filename-from-urlbase';
import transformMetadataFromData from './transform-metadata-from-data';

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
    const filename = isUpdate ? wallpaper.filename : transformFilenameFromUrlbase(wallpaper.urlbase);
    const id = isUpdate ? wallpaper.id : transformFilenameToHashId(filename);
    const [description, address, copyright] = isUpdate
      ? [wallpaper.description, wallpaper.address, wallpaper.copyright]
      : transformMetadataFromData(wallpaper.copyright);

    const newWallpaper = merge(
      new Wallpaper(),
      {
        filename,
        id,
        title: get(wallpaper, ['title']),
        description,
        address,
        copyright,
        lang: ((urlbase) => {
          if (/zh-cn/gi.test(urlbase)) {
            return langEnum['zh-CN'];
          } else if (/en-us/gi.test(urlbase)) {
            return langEnum['en-US'];
          }
        })(get(wallpaper, ['urlbase'])),
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
