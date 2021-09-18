/**
 * 依据数据中的urlbase，转换为文件名(filename)
 *
 * @param {string} urlbase - 文件名
 *
 * @returns {string} 返回filename
 *
 * ```typescript
 * // 生成一个 0 ~ 10 的随机整数
 * import transformFilenameFromUrlbase from 'transform-filename-from-urlbase';
 *
 * transformFilenameToHashId('/th?id=OHR.CanadaLynx_ZH-CN8645816958');
 * >> 'OHR.CanadaLynx_ZH-CN8645816958'
 * ```
 */
export default (urlbase?: string): string => urlbase?.replace(/(.*id=)(\w+)/, '$2').replace(/,/, '');
