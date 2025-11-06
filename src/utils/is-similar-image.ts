import { isString, isNumber, filter } from 'lodash';

// ac地址：https://leetcode-cn.com/problems/hamming-distance/
// 原文地址：https://xxoo521.com/2020-03-04-hamming-distance/
/**
 * @param {number} x
 * @param {number} y
 * @return {number}
 */
const hammingDistance = function (x: number, y: number): number {
  let v = x ^ y; // 异或：相同位为0，不同位为1
  let dis = 0;
  while (v) {
    v = v & (v - 1);
    ++dis;
  }
  return dis;
};

const calcHashHammingDistance = (aHex: string, bHex: string): number => {
  const aBinaryArray = Buffer.from(aHex, 'hex').toJSON().data;
  const bBinaryArray = Buffer.from(bHex, 'hex').toJSON().data;

  if (aBinaryArray.length !== bBinaryArray.length) {
    throw new Error('calcHashHammingDistance: must need two same length hex string.');
  }

  let d = 0;

  for (let i = 0; i < aBinaryArray.length; i++) {
    d += hammingDistance(aBinaryArray[i], bBinaryArray[i]);
  }

  return d;
};

/**
 * 依据多个类型hash值(hex)的汉明距离均值，判断图片是否相似
 *
 * @param {object} a - 图片hash数据集合
 * @param {object} b - 图片hash数据集合
 * @param {number} [similarityHammingDistance=5] - 图片相似度汉明距离临界值，默认为5
 * @returns {boolean}
 */
export default (
  a: {
    pHash: string;
    wHash: string;
    aHash: string;
    dHash: string;
  },
  b: {
    pHash: string;
    wHash: string;
    aHash: string;
    dHash: string;
  },
  similarityHammingDistance = 5,
): boolean => {
  const allHashHammingDistance: number[] = [];

  ['pHash', 'wHash', 'aHash', 'dHash'].forEach((hashName: string) => {
    const aHashHexStr = (a as any)[hashName];
    const bHashHexStr = (b as any)[hashName];
    if (isString(aHashHexStr) && aHashHexStr.length !== 0 && isString(bHashHexStr) && bHashHexStr.length !== 0) {
      try {
        const hashHammingDistance = calcHashHammingDistance(aHashHexStr, bHashHexStr);
        if (isNumber(hashHammingDistance)) {
          allHashHammingDistance.push(hashHammingDistance);
        }
      } catch (error) {
        // console.error(error);
      }
    }
  });

  if (allHashHammingDistance.length === 0) {
    throw new Error('isSimilarImage: must need two valided image hash data.');
  }

  return (
    filter(allHashHammingDistance, (d: number) => d <= similarityHammingDistance).length >=
    Math.ceil(allHashHammingDistance.length * 0.75)
  );
};
