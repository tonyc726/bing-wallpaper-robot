import { isString, isNumber, filter } from 'lodash';

// Reference: https://xxoo521.com/2020-03-04-hamming-distance/
/**
 * Compute Hamming distance between two numbers.
 */
export const hammingDistance = function (x: number, y: number): number {
  let v = x ^ y;
  let dis = 0;
  while (v) {
    v = v & (v - 1);
    ++dis;
  }
  return dis;
};

export const calcHashHammingDistance = (aHex: string, bHex: string): number => {
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
 * Compute the intersection distance between two normalized color histograms.
 * dist = 1 - sum(min(histA[i], histB[i]))
 * Range [0, 1]: 0 = identical, 1 = completely different.
 */
export const colorHistDist = (histA: number[], histB: number[]): number => {
  if (histA.length !== histB.length) {
    return 1;
  }

  let intersection = 0;
  for (let i = 0; i < histA.length; i++) {
    intersection += Math.min(histA[i], histB[i]);
  }

  return 1 - intersection;
};

/**
 * Image hash data used for similarity comparison.
 */
export interface ImageHashData {
  pHash: string;
  wHash: string;
  aHash: string;
  dHash: string;
  colorHist?: string | null;
}

/**
 * 依据多个类型hash值(hex)的汉明距离均值，判断图片是否相似
 *
 * @param {object} a - 图片hash数据集合
 * @param {object} b - 图片hash数据集合
 * @param {number} [similarityHammingDistance=5] - 图片相似度汉明距离临界值，默认为5
 * @returns {boolean}
 */
export default (
  a: ImageHashData,
  b: ImageHashData,
  similarityHammingDistance = 5,
): boolean => {
  const allHashHammingDistance: number[] = [];

  const hashKeys = ['pHash', 'wHash', 'aHash', 'dHash'] as const;

  hashKeys.forEach((hashName) => {
    const aHashHexStr = a[hashName];
    const bHashHexStr = b[hashName];
    if (isString(aHashHexStr) && aHashHexStr.length !== 0 && isString(bHashHexStr) && bHashHexStr.length !== 0) {
      try {
        const hashHammingDistance = calcHashHammingDistance(aHashHexStr, bHashHexStr);
        if (isNumber(hashHammingDistance)) {
          allHashHammingDistance.push(hashHammingDistance);
        }
      } catch (error) {
        // skip
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