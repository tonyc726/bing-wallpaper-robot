/**
 * 生成一个介于 min ~ max 范围的随机整数
 *
 * @param {number} min - 范围最小数
 * @param {number} max - 范围最大数
 *
 * @returns {number} 返回一个整数
 *
 * ```typescript
 * // 生成一个 0 ~ 10 的随机整数
 * import makeRandomNumber from 'make-random-number';
 *
 * makeRandomNumber(0, 10);
 * ```
 */
export default (min = 0, max = 10): number => Math.floor(Math.random() * (max - min + 1)) + min;
