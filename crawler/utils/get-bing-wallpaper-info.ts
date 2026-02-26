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
export default (idx = 0, n = 8): Promise<Array<any>> =>
  new Promise((resolve, reject) => {
    const reqUrl = `https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=${n}`;
    console.log(`> [idx: ${idx}] 正在请求 ${reqUrl}`);
    const req = https.get(reqUrl, (res) => {
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
          console.log(`> [idx: ${idx}] ✔️ 请求成功，共 ${data.images.length} 条数据`);
          resolve(data.images);
        } else {
          reject(new Error('数据异常'));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`> [idx: ${idx}] ❌ 请求失败`);
      console.error(e);
      reject(e);
    });

    req.end();
  });
