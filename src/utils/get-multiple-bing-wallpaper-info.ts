import { flatten } from 'lodash';
import getBingWallpaperInfo from './get-bing-wallpaper-info';

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
  Promise.all([0,1,2,3,4,5,6,7].map(
    (idx) => getBingWallpaperInfo(idx)
  )).then((data) => (
    flatten(data)
  ))
;
