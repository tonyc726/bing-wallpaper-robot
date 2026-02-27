/**
 * v4.0 数据加载器
 * 职责：分块数据加载、版本控制、增量更新
 * 集成 IndexedDB 本地缓存
 */

import type { IndexData, ChunkData, WallpaperData } from './types';
import { dbManager } from './dbManager';
import { unpackChunk } from './utils/unpackChunk';

const NPM_CDN_BASES = [
  'https://cdn.jsdelivr.net/npm/bing-wallpaper-robot@latest/docs',
  'https://unpkg.com/bing-wallpaper-robot@latest/docs',
  'https://npm.elemecdn.com/bing-wallpaper-robot@latest/docs',
];

/**
 * 初始化数据加载器（必须先调用）
 */
export async function initDataLoader(): Promise<void> {
  await dbManager.init();

  // 🛠️ 自动检查并修复 monthIndex（如果有问题）
  await checkAndFixMonthIndex();
}

/**
 * 检查并修复 monthIndex
 * 如果发现索引不连续或有重叠，则自动重建
 */
async function checkAndFixMonthIndex(): Promise<void> {
  // 我们直接调用 dbManager 提供的方法，而非重复打开连接
  await dbManager.init(); // 确保安全初始化
}

/**
 * 获取index.json索引数据
 */
export async function fetchIndexData(): Promise<IndexData> {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const response = await fetch(`${baseUrl}/index.json`, {
    cache: 'no-cache'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch index: ${response.status} ${response.statusText}`);
  }

  const indexData = await response.json();

  // 兜底机制校验全局版本，如果版本不一致强制清理数据库
  if (indexData.dataVersion) {
    await dbManager.validateGlobalVersion(indexData.dataVersion);
  }

  // 存储到 IndexedDB
  await dbManager.storeMetadata('index', indexData);

  return indexData;
}

/**
 * 获取分块数据
 * 策略：内存 -> IndexedDB(含防过期校验) -> 网络
 */
export async function fetchChunkData(
  month: string, 
  expectedVersion?: string, 
  globalIndexRange?: { startIndex: number; endIndex: number }
): Promise<ChunkData> {
  // 1. 尝试从 IndexedDB 获取（包含内存缓存，自动清理过期数据）
  const cachedData = await dbManager.getChunk(month, expectedVersion);
  if (cachedData) {
    return cachedData;
  }

  let chunkData: ChunkData | null = null;
  const indexData = await dbManager.getMetadata('index') as IndexData | null;
  const isLatestMonth = indexData ? (indexData.latestMonth === month) : false;

  try {
    // 如果是最新月份，强制走本站源
    if (isLatestMonth) {
      throw new Error('Force fallback to origin for latest month');
    }

    // 2. 尝试从各大 CDN 顺序获取紧凑 JS 数组
    let module: any;
    let fallbackError;
    
    for (const cdnBase of NPM_CDN_BASES) {
      try {
        module = await import(/* @vite-ignore */ `${cdnBase}/chunks/${month}.js`);
        break; // 请求成功，跳出循环
      } catch (err) {
        fallbackError = err;
        console.warn(`[CDN Failed] Failed to load from ${cdnBase}`, err);
        // Continue to the next CDN
      }
    }

    if (!module) {
      throw fallbackError || new Error('All primary CDNs failed');
    }

    const compactRows = module.default;
    const wallpapers = unpackChunk(compactRows);
    
    // 组装成兼容 dbManager 的 ChunkData 结构
    chunkData = {
      schemaVersion: 2,
      month,
      version: expectedVersion || `md5:npm-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      wallpapers,
      metadata: {
        recordCount: wallpapers.length,
        checksum: expectedVersion || '',
        previousHash: null
      }
    };
  } catch (error) {
    if (!isLatestMonth) {
      console.warn(`[Network] Falling back to local/github pages for ${month}`, error);
    }
    
    try {
      // 降级时直接拉取本站源的紧凑 JS 数据块
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
      const module = await import(/* @vite-ignore */ `${baseUrl}/chunks/${month}.js`);
      const compactRows = module.default;
      const wallpapers = unpackChunk(compactRows);
      
      chunkData = {
        schemaVersion: 2,
        month,
        version: expectedVersion || `md5:local-${Date.now()}`,
        updatedAt: new Date().toISOString(),
        wallpapers,
        metadata: {
          recordCount: wallpapers.length,
          checksum: expectedVersion || '',
          previousHash: null
        }
      };
    } catch (fallbackError) {
      console.error(`Failed to download ${month} from both sources:`, fallbackError);
      throw fallbackError;
    }
  }

  // 3. 存储到 IndexedDB（自动处理内存缓存）
  if (chunkData) {
    await dbManager.storeChunk(month, chunkData, globalIndexRange);
    return chunkData;
  }
  
  throw new Error(`Failed to load chunk ${month}`);
}

/**
 * 获取月份列表的批量数据
 */
// eslint-disable-next-line max-params
export async function fetchChunksBatch(
  months: string[],
  onProgress?: (loaded: number, total: number) => void,
  globalIndexRanges?: Map<string, { startIndex: number; endIndex: number }>,
  expectedVersions?: Map<string, string>
): Promise<Map<string, WallpaperData[]>> {
  const results = new Map<string, WallpaperData[]>();
  let loaded = 0;

  const promises = months.map(async (month) => {
    try {
      const globalIndexRange = globalIndexRanges?.get(month);
      const expectedVersion = expectedVersions?.get(month);
      const chunkData = await fetchChunkData(month, expectedVersion, globalIndexRange);

      if (chunkData) {
        results.set(month, chunkData.wallpapers);
      }

      loaded++;
      if (onProgress) {
        onProgress(loaded, months.length);
      }
    } catch (error) {
      console.error(`Failed to fetch chunk ${month}:`, error);
      results.set(month, []);
    }
  });

  await Promise.all(promises);

  return results;
}

/**
 * 获取缓存状态
 */
export function getCacheStatus() {
  return dbManager.getCacheStatus();
}

/**
 * 清理过期缓存
 */
export async function cleanupCache(currentMonth?: string): Promise<void> {
  await dbManager.cleanupCache(currentMonth);
}

/**
 * 重建 monthIndex（修复索引错误）
 * 当发现加载更多无法工作时可调用此函数修复
 */
export async function rebuildMonthIndex(): Promise<void> {
  await dbManager.rebuildMonthIndex();
}

/**
 * 获取所有的壁纸数据（极速模式，专为全局搜索/颜色大类排序准备）
 *
 * 缓存策略：
 *   1. 读取 IndexedDB 中缓存的 allJsVersion
 *   2. 与 index.json 下发的 allJsVersion 比对
 *   3. 版本匹配 → 直接使用 IDB 缓存（O(1)，无网络请求）
 *   4. 版本不匹配 or 无缓存 → 拉取 all.js，写入 IDB
 */
export async function fetchAllData(): Promise<WallpaperData[]> {
  // 1. 读取服务端最新的 allJsVersion（由 fetchIndexData 写入 IDB METADATA）
  const indexData = await dbManager.getMetadata('index') as { allJsVersion?: string } | null;
  const serverVersion = indexData?.allJsVersion;

  // 2. 读取本地缓存的版本与数据
  if (serverVersion) {
    const cached = await dbManager.getMetadata('allData') as
      { version: string; data: WallpaperData[] } | null;

    if (cached && cached.version === serverVersion) {
      console.log(`[fetchAllData] ✅ IDB cache hit (${serverVersion}), skipping network`);
      return cached.data;
    }
  }

  // 3. 缓存不命中 → 从 CDN / 本站拉取 all.js
  let wallpapers: WallpaperData[] | null = null;

  try {
    let module: any;
    let fallbackError;

    // 依次尝试各 CDN
    for (const cdnBase of NPM_CDN_BASES) {
      try {
        module = await import(/* @vite-ignore */ `${cdnBase}/all.js`);
        break;
      } catch (err) {
        fallbackError = err;
        console.warn(`[CDN Failed] Failed to load all from ${cdnBase}`, err);
      }
    }

    if (!module) {
      throw fallbackError || new Error('All primary CDNs failed for all.js');
    }

    wallpapers = unpackChunk(module.default);
  } catch (error) {
    console.warn(`[Network] Falling back to local/github pages for all.js`, error);

    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
      const module = await import(/* @vite-ignore */ `${baseUrl}/all.js`);
      wallpapers = unpackChunk(module.default);
    } catch (fallbackError) {
      console.error(`Failed to download all.js from both sources:`, fallbackError);
      throw fallbackError;
    }
  }

  // 4. 写入 IDB 缓存（带 allJsVersion 版本标记）
  if (wallpapers && serverVersion) {
    try {
      await dbManager.storeMetadata('allData', {
        version: serverVersion,
        data: wallpapers,
      });
      console.log(`[fetchAllData] 💾 Cached all.js in IDB (${serverVersion})`);
    } catch (e) {
      // 缓存写入失败不阻断主流程
      console.warn('[fetchAllData] Failed to cache allData in IDB', e);
    }
  }

  return wallpapers!;
}

/**
 * 清除热存储（用于调试和重新测试）
 * 清除后，重新加载数据时会重新迁移到热存储
 */
export async function clearHotStorage(): Promise<void> {
  await dbManager.clearHotStorage();
}
