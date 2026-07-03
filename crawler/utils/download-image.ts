import * as https from 'https';
import * as fs from 'fs';
import { isString } from 'lodash';

const DOWNLOAD_TIMEOUT_MS = 30_000;

/**
 * 下载 Bing壁纸图片至本地
 *
 * @returns {Promise<fs.Stats>} 下载成功后返回该文件的 stat 信息
 *
 * ```typescript
 * import downloadImage from 'download-image';
 *
 * const stat = await downloadImage(url, saveFilePath);
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

    const file = fs.createWriteStream(saveFilePath);
    let settled = false;

    const cleanup = () => {
      try {
        fs.unlinkSync(saveFilePath);
      } catch {}
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      file.close();
      cleanup();
      reject(error);
    };

    const req = https.get(url, (res) => {
      // 非 200（如 404 占位页）不应被当作有效图片写入本地
      if (res.statusCode !== 200) {
        res.resume();
        fail(new Error(`downloadImage: HTTP ${res.statusCode} for ${url}`));
        return;
      }

      res.pipe(file);

      file.on('error', (err) => {
        fail(err);
      });

      file.on('finish', () => {
        if (settled) {
          return;
        }
        settled = true;
        file.close();
        resolve(fs.statSync(saveFilePath));
      });
    });

    // 超时保护:避免单次连接挂起拖垮整条采集流程
    req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      req.destroy(new Error(`downloadImage: timeout after ${DOWNLOAD_TIMEOUT_MS}ms for ${url}`));
    });

    req.on('error', (err) => {
      fail(err);
    });
  });
