import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

/**
 * Download an image from URL to the specified local path.
 * Returns the destination file path on success.
 */
export const downloadTo = async (url: string, destPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlinkSync(destPath);
        reject(new Error(`downloadTo: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      try {
        fs.unlinkSync(destPath);
      } catch {}
      reject(err);
    });
  });
};
