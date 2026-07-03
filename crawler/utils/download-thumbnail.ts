import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

const DOWNLOAD_TIMEOUT_MS = 30_000;

/**
 * Download an image from URL to the specified local path.
 * Returns the destination file path on success.
 */
export const downloadTo = async (url: string, destPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    let settled = false;

    const fail = (err: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      file.close();
      try {
        fs.unlinkSync(destPath);
      } catch {}
      reject(err);
    };

    const req = protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        fail(new Error(`downloadTo: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('error', (err) => fail(err));
      file.on('finish', () => {
        if (settled) {
          return;
        }
        settled = true;
        file.close();
        resolve(destPath);
      });
    });

    // 超时保护:避免连接挂起拖垮整条采集流程
    req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
      req.destroy(new Error(`downloadTo: timeout after ${DOWNLOAD_TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => fail(err));
  });
};
