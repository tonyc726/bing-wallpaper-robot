import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Transform as Stream } from 'stream';

/**
 * 请求 Bing壁纸 数据
 *
 * @returns {Promise} 返回一个整数
 *
 * ```typescript
 * // 生成一个 0 ~ 10 的随机整数
 * import getImageAndEncodeBase64 from 'get-image-encode-base64';
 *
 * const imageBase64 = await getImageAndEncodeBase64(url);
 * ```
 */
// export default (url): Promise<Array<any>> =>
const getImageAndEncodeBase64 = (url: string, saveFilePath: string) =>
  new Promise<string>((resolve, reject) => {
    const file = fs.createWriteStream(path.resolve(__dirname, '../../docs/thumbs/', saveFilePath));
    const data = new Stream();
    https.get(url, (res) => {
      res.pipe(file);

      file.on('error', (error) => {
        reject(error);
      });

      file.on('finish', () => {
        file.close();

        console.log('缩率图保存成功');
      });

      res.on('data', (chunk) => {
        data.push(chunk);
      });

      res.on('error', (error) => {
        reject(error);
      });

      res.on('end', () => {
        resolve(`data:${res.headers['content-type']};base64,${Buffer.from(data.read()).toString('base64')}`);
      });
    });
  });

(async () => {
  await getImageAndEncodeBase64(
    'https://cn.bing.com/th?id=OHR.FatherEagle_ZH-CN6127856255_UHD.jpg&w=128&c=1',
    'OHR.FatherEagle_ZH-CN6127856255_UHD_128.jpg',
  );
})();
