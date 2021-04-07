import * as crypto from 'crypto';

/**
 * 依据文件名(filename)，生成hash值，作为文件ID
 *
 * @param {string} fileName - 文件名
 *
 * @returns {string} 返回hash值
 *
 * ```typescript
 * // 生成一个 0 ~ 10 的随机整数
 * import transfromFilenameToHashId from 'transfrom-filename-to-hash-id';
 *
 * transfromFilenameToHashId('filename');
 * >> '5b063e275d506f65ebf1b02d926f19a4'
 * ```
 */
export default (fileName: string): string => crypto.createHash('md5').update(fileName).digest('hex');
