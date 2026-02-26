import { uniqBy } from 'lodash';
import getBingWallpaperInfo from './get-bing-wallpaper-info';

interface BingWallpaperData {
  hsh: string;
  [key: string]: any;
}

const getBingWallpaperInfoWithRetry = async (idx: number, n = 8, maxRetry = 5): Promise<BingWallpaperData[]> => {
  let result: BingWallpaperData[] = [];
  try {
    result = await getBingWallpaperInfo(idx, n);
  } catch (e) {
    if (maxRetry >= 0) {
      result = await getBingWallpaperInfoWithRetry(idx, n, maxRetry - 1);
    }
  }
  return result;
};

/**
 * 请求 Bing壁纸 数据
 *
 * @returns {Promise} 返回壁纸数据数组
 *
 * ```typescript
 * // 获取壁纸数据
 * import getBingWallpaperInfo from 'get-bing-wallpaper-info';
 *
 * const bingWallpapers = await getBingWallpaperInfo();
 * ```
 */
export default async (): Promise<BingWallpaperData[]> => {
  const multipleResult: BingWallpaperData[] = [];
  for (const idx of [0, 1, 2, 3, 4, 5, 6, 7]) {
    try {
      const getBingWallpaperResult = await getBingWallpaperInfoWithRetry(idx);
      multipleResult.push(...getBingWallpaperResult);
    } catch (error) {
      console.error(error);
    }
  }
  return uniqBy(multipleResult, 'hsh');
};
