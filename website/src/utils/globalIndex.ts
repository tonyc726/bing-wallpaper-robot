/**
 * 全局索引管理
 * 职责：构建全局索引表，实现精确分页算法
 */

import type { IndexData } from '../types';

// 全局索引表接口
export interface GlobalIndex {
  [wallpaperId: string]: {
    month: string;           // 所属月份
    globalIndex: number;     // 全局索引 (0-1815)
    localIndex: number;      // 月份内索引 (0-该月recordCount-1)
  };
}

// 目标范围接口
export interface MonthRange {
  month: string;            // 月份
  startOffset: number;      // 起始位置 (月份内)
  endOffset: number;        // 结束位置 (月份内)
  count: number;            // 需要加载的张数
}

// 加载范围结果
export interface LoadRangeResult {
  targetMonths: MonthRange[];    // 目标月份和范围
  needsDownload: string[];       // 需要下载的月份
}

/**
 * 构建全局索引表
 * 从 index.json 构建索引范围（不依赖具体壁纸ID）
 * 注意：由于无法从 index.json 获取具体壁纸ID，
 * 我们构建基于月份的索引范围，而不是每个壁纸的索引
 */
export function buildGlobalIndex(indexData: IndexData): GlobalIndex {
  const index: GlobalIndex = {};
  let globalPos = 0;

  // 构建月份起始索引映射
  const monthStartIndex: { [month: string]: number } = {};

  // 按照 monthList 的顺序遍历（从新到旧）
  for (const month of indexData.monthList) {
    const metadata = indexData.chunks[month];
    if (!metadata) continue;

    // 记录该月份的起始索引
    monthStartIndex[month] = globalPos;

    const recordCount = metadata.recordCount;

    // 为该月份的每张壁纸创建索引（使用月份+序号作为虚拟ID）
    // 注意：这里使用的是虚拟ID，不是真实壁纸ID
    for (let localPos = 0; localPos < recordCount; localPos++) {
      // 虚拟ID格式：${month}-${localPos}
      // 用于计算和演示，实际使用时需要从真实数据中获取ID
      const wallpaperId = `${month}-${String(localPos).padStart(3, '0')}`;

      index[wallpaperId] = {
        month,
        globalIndex: globalPos,
        localIndex: localPos
      };
      globalPos++;
    }
  }


  return index;
}

/**
 * 计算加载范围
 * 根据最后一张壁纸的ID，精确计算需要加载的月份和范围
 */
// eslint-disable-next-line max-params
export function calculateLoadRange(
  lastWallpaperId: string,
  itemsPerPage: number,
  globalIndex: GlobalIndex,
  indexData: IndexData
): LoadRangeResult {
  // 1. 获取最后一张壁纸的信息
  const lastInfo = globalIndex[lastWallpaperId];
  if (!lastInfo) {
    return { targetMonths: [], needsDownload: [] };
  }

  // 2. 计算全局索引范围
  const startGlobalIndex = lastInfo.globalIndex + 1;
  const endGlobalIndex = startGlobalIndex + itemsPerPage - 1;


  const targetMonths: MonthRange[] = [];
  const needsDownload: string[] = [];

  // 3. 遍历所有壁纸ID，找到在范围内的壁纸
  // 然后按月份分组
  const rangeByMonth = new Map<string, { min: number; max: number }>();

  for (const [, info] of Object.entries(globalIndex)) {
    const idx = info.globalIndex;

    // 检查是否在加载范围内
    if (idx >= startGlobalIndex && idx <= endGlobalIndex) {
      const month = info.month;
      const existing = rangeByMonth.get(month);

      if (existing) {
        existing.min = Math.min(existing.min, info.localIndex);
        existing.max = Math.max(existing.max, info.localIndex);
      } else {
        rangeByMonth.set(month, { min: info.localIndex, max: info.localIndex });
      }
    }
  }

  // 4. 构建结果
  for (const [month, range] of rangeByMonth) {
    const startOffset = range.min;
    const endOffset = range.max;
    const count = endOffset - startOffset + 1;

    targetMonths.push({
      month,
      startOffset,
      endOffset,
      count
    });

  }

  // 5. 按monthList的顺序排序
  targetMonths.sort((a, b) => {
    const aIndex = indexData.monthList.indexOf(a.month);
    const bIndex = indexData.monthList.indexOf(b.month);
    return aIndex - bIndex;
  });


  return { targetMonths, needsDownload };
}

/**
 * 获取下一个月份
 */
export function getNextMonth(currentMonth: string): string | null {
  const [year, month] = currentMonth.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${nextMonth.toString().padStart(2, '0')}`;
}

/**
 * 获取上一个月份
 */
export function getPrevMonth(currentMonth: string): string | null {
  const [year, month] = currentMonth.split('-').map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
}
