import * as https from 'https';
import * as fs from 'fs';
import { isString } from 'lodash';

/**
 * 下载 Bing壁纸图片至本地
 *
 * @returns {Promise} 返回一个整数
 *
 * ```typescript
 * import downloadImage from 'download-image';
 *
 * const imageBase64 = await downloadImage(url);
 * ```
 */
export default (url: string, saveFilePath: string): Promise<fs.Stats> =>
  new Promise((resolve, reject) => {
    if (isString(url) === false || url.length === 0) {
      reject(new Error('downloadImage must need the image url.'));
      return;
    }
    if (isString(saveFilePath) === false || saveFilePath.length === 0) {
      reject(new Error('downloadImage must need the image save path.'));
      return;
    }

    // path.resolve(__dirname, '../../docs/thumbs/', saveFilePath)
    const file = fs.createWriteStream(saveFilePath);

    https.get(url, (res) => {
      res.pipe(file);

      file.on('error', (err) => {
        reject(err);
      });

      file.on('finish', () => {
        file.close();

        resolve(fs.statSync(saveFilePath));
      });
    });
  });
