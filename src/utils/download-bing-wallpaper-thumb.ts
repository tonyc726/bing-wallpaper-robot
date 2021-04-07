import * as https from 'https';

/**
 * 请求 Bing壁纸 数据
 *
 * @returns {Promise} 返回一个整数
 *
 * ```typescript
 * // 生成一个 0 ~ 10 的随机整数
 * import getBingWallpaperInfo from 'get-bing-wallpaper-info';
 *
 * const bingWallpapers = await getBingWallpaperInfo();
 * ```
 */
export default (): Promise<Array<any>> =>
  new Promise((resolve, reject) => {
    const req = https.get('https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8', (res) => {
      if (res.statusCode !== 200) {
        reject(new Error('请求失败了'));
      }

      const dataBuffer: any = [];

      res.on('data', (d) => {
        dataBuffer.push(d);
      });

      res.on('end', () => {
        let data = null;
        try {
          data = JSON.parse(dataBuffer);
        } catch (error) {
          reject(error);
        }
        if (data !== null && Array.isArray(data.images)) {
          resolve(data.images);
        } else {
          reject(new Error('数据异常'));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
