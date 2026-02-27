/* eslint-disable no-empty */
/**
 * v3.0+ IndexedDB 存储层
 * 职责：本地数据缓存、版本控制、LRU淘汰
 */

/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable no-async-promise-executor */
/* eslint-disable no-promise-executor-return */
/* eslint-disable max-params */

import type { ChunkData, WallpaperData } from './types';

const DB_NAME = 'bing-wallpapers-v4';
const DB_VERSION = 6;

// 对象存储名称
const STORES = {
  WALLPAPERS_HOT: 'wallpapers_hot',  // 热数据：扁平化存储 (最近6个月)
  CHUNKS_COLD: 'chunks_cold',        // 冷数据：chunk聚合 (超过6个月)
  MONTH_INDEX: 'monthIndex',         // 月份索引：globalIndex 范围映射
  METADATA: 'metadata',              // 元数据：版本、配置等
} as const;

// 缓存配置 (v4.0 优化)
const CACHE_CONFIG = {
  // 内存缓存：按 globalIndex 的 LRU (6页 × 24张 = 144张)
  maxMemoryCache: 144,
  maxHotEntries: 2000,         // 热存储最大条目数
  maxDBCache: 24,              // IndexedDB缓存最多24个月
  cleanupInterval: 24 * 60 * 60 * 1000,  // 24小时清理一次

  // 热冷分层阈值
  hotMonthsThreshold: 6,       // 最近6个月为热数据
} as const;

// MonthIndex 记录类型（内存镜像）
interface MonthIndexRecord {
  month: string;
  startIndex: number;
  endIndex: number;
  recordCount: number;
}

class DBManager {
  private db: IDBDatabase | null = null;

  // v3.0 兼容：按月份的内存缓存（Map 按插入顺序 = LRU 顺序）
  private memoryCache = new Map<string, ChunkData>();
  private accessOrder: string[] = [];

  // v4.0 新增：按 globalIndex 的 LRU 缓存
  // 利用 ES6 Map 的严格插入顺序实现 O(1) LRU（替代原有 indexOf+splice O(N) 方案）
  private lruCache = new Map<number, WallpaperData>();  // globalIndex -> WallpaperData（按访问新旧排序）

  // v4.0 新增：MONTH_INDEX 常驻内存镜像，消除高频读路径的 IndexedDB 事务开销
  private cachedMonthIndex = new Map<string, MonthIndexRecord>();

  /**
   * 初始化数据库 (v4.0)
   * 纯 v4.0 架构，无需迁移，但需要重建 monthIndex（如果缺失）
   */
  public async init(): Promise<void> {

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        console.warn('[DB Cache] Database is blocked, attempting to close and delete...');
        if (this.db) {
          this.db.close();
          this.db = null;
        }
        reject(new Error('IndexedDB blocked'));
      };

      request.onsuccess = async () => {
        this.db = request.result;

        // 检查是否需要重建 monthIndex
        try {
          await this.checkAndRebuildMonthIndex();
        } catch (e) {}

        // 🚀 性能优化：将全部 MONTH_INDEX 载入内存，消除高频读路径的事务开销
        try {
          await this.loadMonthIndexToMemory();
        } catch (e) {}

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        const oldVersion = event.oldVersion;
        const newStores: string[] = [];


        // v5.0: 重建热数据存储（移除 autoIncrement，使用自定义 globalIndex）
        if (oldVersion < 5) {
          if (db.objectStoreNames.contains(STORES.WALLPAPERS_HOT)) {
            db.deleteObjectStore(STORES.WALLPAPERS_HOT);
          }
          const hotStore = db.createObjectStore(STORES.WALLPAPERS_HOT, {
            keyPath: 'globalIndex'
          });
          hotStore.createIndex('month', 'month', { unique: false });
          hotStore.createIndex('id', 'id', { unique: false });
          newStores.push(STORES.WALLPAPERS_HOT);
        } else if (!db.objectStoreNames.contains(STORES.WALLPAPERS_HOT)) {
          const hotStore = db.createObjectStore(STORES.WALLPAPERS_HOT, {
            keyPath: 'globalIndex'
          });
          hotStore.createIndex('month', 'month', { unique: false });
          hotStore.createIndex('id', 'id', { unique: false });
          hotStore.createIndex('cachedAt', 'cachedAt', { unique: false });
          newStores.push(STORES.WALLPAPERS_HOT);
        }

        // v6.0: 为热数据增加 cachedAt 索引 (如果之前没有)
        if (oldVersion >= 5 && oldVersion < 6) {
          const hotStore = transaction!.objectStore(STORES.WALLPAPERS_HOT);
          if (!hotStore.indexNames.contains('cachedAt')) {
            hotStore.createIndex('cachedAt', 'cachedAt', { unique: false });
          }
        }

        // v4.0 新增：冷数据 chunk 聚合
        if (!db.objectStoreNames.contains(STORES.CHUNKS_COLD)) {
          const coldStore = db.createObjectStore(STORES.CHUNKS_COLD, {
            keyPath: 'month'
          });
          coldStore.createIndex('byVersion', 'version', { unique: false });
          coldStore.createIndex('byCachedAt', 'cachedAt', { unique: false });
          newStores.push(STORES.CHUNKS_COLD);
        }

        // v4.0 新增：月份索引
        if (!db.objectStoreNames.contains(STORES.MONTH_INDEX)) {
          db.createObjectStore(STORES.MONTH_INDEX, {
            keyPath: 'month'
          });
          newStores.push(STORES.MONTH_INDEX);
        }

        // 保留：元数据存储
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          const metadataStore = db.createObjectStore(STORES.METADATA, {
            keyPath: 'key'
          });
          metadataStore.createIndex('byKey', 'key', { unique: true });
          newStores.push(STORES.METADATA);
        }

        // 纯 v4.0 架构，无需 v3.0 兼容性

        if (newStores.length > 0) {} else {}
      };
    });
  }

  /**
   * v4.0：检查并重建 monthIndex
   * 如果有 chunks_cold 数据但没有 monthIndex，则重建
   */
  private async checkAndRebuildMonthIndex(): Promise<void> {
    if (!this.db) return;


    // 检查是否已有 monthIndex
    const monthIndexCount = await new Promise<number>((resolve, reject) => {
      const tx = this.db!.transaction([STORES.MONTH_INDEX], 'readonly');
      const store = tx.objectStore(STORES.MONTH_INDEX);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // 检查是否有 chunks_cold 数据
    const chunksCount = await new Promise<number>((resolve, reject) => {
      const tx = this.db!.transaction([STORES.CHUNKS_COLD], 'readonly');
      const store = tx.objectStore(STORES.CHUNKS_COLD);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });


    // 如果有 chunks 但没有 monthIndex，则需要重建
    if (chunksCount > 0 && monthIndexCount === 0) {

      await this.rebuildMonthIndexFromChunks();
    } else {}
  }

  /**
   * 验证全局版本号 (v4.0 兜底机制)
   * 发现版本不兼容时，强行清空所有客户端缓存
   */
  public async validateGlobalVersion(serverDataVersion: string): Promise<void> {
    if (!this.db) return;
    
    const storedMetadata = await this.getMetadata('index') as { dataVersion: string } | null;
    if (storedMetadata && storedMetadata.dataVersion !== serverDataVersion) {
      console.warn(`[DB Cache] 🚨 Global version mismatch! Local: ${storedMetadata.dataVersion}, Server: ${serverDataVersion}. Rebuilding...`);
      await this.clearAllData();
    }
  }

  /**
   * 清空本地所有数据，通常用于全局架构升级或严重损坏兜底
   */
  private async clearAllData(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        [STORES.WALLPAPERS_HOT, STORES.CHUNKS_COLD, STORES.MONTH_INDEX, STORES.METADATA],
        'readwrite'
      );
      
      tx.objectStore(STORES.WALLPAPERS_HOT).clear();
      tx.objectStore(STORES.CHUNKS_COLD).clear();
      tx.objectStore(STORES.MONTH_INDEX).clear();
      // 元数据也清空，下次 fetchIndexData 会重新填充
      tx.objectStore(STORES.METADATA).clear();

      tx.oncomplete = () => {
        // 清理内存
        this.memoryCache.clear();
        this.accessOrder = [];
        this.lruCache.clear();
        this.cachedMonthIndex.clear();
        
        console.log('[DB Cache] 🗑️ All data successfully cleared built-in db reset.');
        resolve();
      };
      
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * v4.0：从现有的 chunks 重建 monthIndex，同步更新内存镜像
   */
  private async rebuildMonthIndexFromChunks(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.CHUNKS_COLD, STORES.MONTH_INDEX], 'readwrite');
      const chunksStore = tx.objectStore(STORES.CHUNKS_COLD);
      const indexStore = tx.objectStore(STORES.MONTH_INDEX);

      const getAllRequest = chunksStore.getAll();

      getAllRequest.onsuccess = () => {
        const allChunks = getAllRequest.result || [];
        let cumulativeIndex = 0;

        // 清理内存镜像后重建
        this.cachedMonthIndex.clear();

        for (const chunk of allChunks) {
          const recordCount = chunk.wallpapers?.length || 0;
          const startIndex = cumulativeIndex;
          const endIndex = startIndex + recordCount - 1;

          const monthIndexRecord = {
            month: chunk.month,
            startIndex,
            endIndex,
            recordCount,
            createdAt: new Date().toISOString(),
            rebuiltAt: new Date().toISOString()
          };

          indexStore.put(monthIndexRecord);
          // 同步更新内存镜像
          this.cachedMonthIndex.set(chunk.month, { month: chunk.month, startIndex, endIndex, recordCount });

          cumulativeIndex = endIndex + 1;
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  /**
   * 将全量 MONTH_INDEX 从 IndexedDB 载入内存
   * 在 init() 后调用，使后续所有 monthIndex 查询变为同步 O(1) 内存操作
   */
  private async loadMonthIndexToMemory(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.MONTH_INDEX], 'readonly');
      const store = tx.objectStore(STORES.MONTH_INDEX);
      const request = store.getAll();

      request.onsuccess = () => {
        this.cachedMonthIndex.clear();
        for (const record of (request.result || [])) {
          this.cachedMonthIndex.set(record.month, {
            month: record.month,
            startIndex: record.startIndex,
            endIndex: record.endIndex,
            recordCount: record.recordCount,
          });
        }
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 获取分块数据（内存 -> IndexedDB -> 处理过期 -> 网络）
   * v4.0: 增加 expectedVersion 以支持强制缓存淘汰
   */
  public async getChunk(month: string, expectedVersion?: string): Promise<ChunkData | null> {

    // 1. 尝试从内存缓存获取
    if (this.memoryCache.has(month)) {
      const data = this.memoryCache.get(month)!;
      if (!expectedVersion || data.version === expectedVersion) {
        this.updateAccessOrder(month);
        return data;
      } else {
        // 版本不匹配，淘汰内存缓存
        this.memoryCache.delete(month);
      }
    }

    // 2. 尝试从冷存储获取
    const chunkData = await this.getChunkFromDB(month, expectedVersion);
    if (chunkData) {
      this.addToMemoryCache(month, chunkData);
      return chunkData;
    }

    // 3. 返回 null（由上层从网络获取）
    return null;
  }

  /**
   * 存储分块到冷存储
   * v4.0: 使用 chunks_cold 存储 + 构建 monthIndex
   */
  public async storeChunk(month: string, data: ChunkData, globalIndexRange?: { startIndex: number; endIndex: number }): Promise<void> {
    if (!this.db) return;


    return new Promise(async (resolve, reject) => {
      try {
        // 1. 计算全局索引范围 (优先使用传入的范围)
        let startIndex: number;
        let endIndex: number;

        if (globalIndexRange) {
          startIndex = globalIndexRange.startIndex;
          endIndex = globalIndexRange.endIndex;
        } else {
          const range = await this.calculateGlobalIndexRange(month, data.wallpapers.length);
          startIndex = range.startIndex;
          endIndex = range.endIndex;
        }


        // 2. 存储 chunk
        const transaction = this.db!.transaction([STORES.CHUNKS_COLD], 'readwrite');
        const store = transaction.objectStore(STORES.CHUNKS_COLD);

        const chunkRecord = {
          month,
          version: data.version,
          wallpapers: data.wallpapers,  // v4.0: 直接存储数组
          cachedAt: new Date().toISOString(),
          size: JSON.stringify(data).length
        };


        const request = store.put(chunkRecord);

        request.onsuccess = async () => {
          try {
            // 3. 构建 monthIndex (v4.0 关键：.enable getByRange)
            await this.buildMonthIndex(month, startIndex, endIndex, data.wallpapers.length);

            this.addToMemoryCache(month, data);
            resolve();
          } catch (err) {
            reject(err);
          }
        };

        request.onerror = () => {

          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 删除分块
   * v4.0: 从冷存储删除
   */
  public async deleteChunk(month: string): Promise<void> {
    if (!this.db) return;


    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHUNKS_COLD], 'readwrite');
      const store = transaction.objectStore(STORES.CHUNKS_COLD);


      const request = store.delete(month);

      request.onsuccess = () => {
        this.memoryCache.delete(month);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 存储元数据
   */
  public async storeMetadata(key: string, value: unknown): Promise<void> {
    if (!this.db) return;


    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.METADATA], 'readwrite');
      const store = transaction.objectStore(STORES.METADATA);


      const record = {
        key,
        value,
        updatedAt: new Date().toISOString()
      };

      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 获取元数据
   */
  public async getMetadata(key: string): Promise<any | null> {
    if (!this.db) return null;


    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.METADATA], 'readonly');
      const store = transaction.objectStore(STORES.METADATA);


      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result?.value || null;

        if (result) {} else {}

        resolve(result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 清理过期缓存
   */
  public async cleanupCache(currentMonth?: string): Promise<void> {
    try {
      // 如果没有指定当前月份，从元数据获取
      let targetMonth = currentMonth;
      if (!targetMonth && this.db) {
        const indexData = await this.getMetadata('index');
        if (indexData) {
          targetMonth = indexData.latestMonth;
        }
      }

      if (!targetMonth) {
        return;
      }

      // 保留最近 N 个月的数据
      const monthsToKeep = this.getRecentMonths(targetMonth, CACHE_CONFIG.maxDBCache);

      if (!this.db) return;

      const transaction = this.db!.transaction([STORES.CHUNKS_COLD], 'readwrite');
      const store = transaction.objectStore(STORES.CHUNKS_COLD);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const allChunks = getAllRequest.result;
        allChunks.forEach(chunk => {
          if (!monthsToKeep.includes(chunk.month)) {
            store.delete(chunk.month);
            this.memoryCache.delete(chunk.month);
          }
        });
      };
    } catch (e) {}
  }

  /**
   * 重建正确的 monthIndex
   * 当发现索引错误时调用此方法修复，同步更新内存镜像
   */
  public async rebuildMonthIndex(): Promise<void> {
    if (!this.db) return;

    return new Promise(async (resolve, reject) => {
      try {
        // 1. 获取所有 chunks
        const tx = this.db!.transaction([STORES.CHUNKS_COLD], 'readonly');
        const store = tx.objectStore(STORES.CHUNKS_COLD);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          const allChunks = getAllRequest.result || [];

          if (allChunks.length === 0) {
            resolve();
            return;
          }

          // 2. 按月份时间顺序排序（从旧到新）
          allChunks.sort((a, b) => a.month.localeCompare(b.month));

          // 3. 重新计算正确的索引
          const writeTx = this.db!.transaction([STORES.MONTH_INDEX], 'readwrite');
          const writeStore = writeTx.objectStore(STORES.MONTH_INDEX);

          // 先清空旧的索引及内存镜像
          writeStore.clear();
          this.cachedMonthIndex.clear();

          let cumulativeIndex = 0;

          allChunks.forEach(chunk => {
            const recordCount = chunk.wallpapers?.length || 0;
            const startIndex = cumulativeIndex;
            const endIndex = cumulativeIndex + recordCount - 1;

            const monthIndexRecord = {
              month: chunk.month,
              startIndex,
              endIndex,
              recordCount,
              createdAt: new Date().toISOString()
            };

            writeStore.put(monthIndexRecord);
            // 同步更新内存镜像
            this.cachedMonthIndex.set(chunk.month, { month: chunk.month, startIndex, endIndex, recordCount });

            cumulativeIndex += recordCount;
          });

          writeTx.oncomplete = () => resolve();
          writeTx.onerror = () => reject(writeTx.error);
        };

        getAllRequest.onerror = () => reject(getAllRequest.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * v4.0: 清除热存储（用于调试和重新测试）
   */
  public async clearHotStorage(): Promise<void> {
    if (!this.db) return;


    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.WALLPAPERS_HOT], 'readwrite');
      const store = tx.objectStore(STORES.WALLPAPERS_HOT);
      const request = store.clear();

      request.onsuccess = () => {
        // 清除 LRU 缓存
        this.lruCache.clear();

        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 检查分块是否在缓存中 (O(1))
   */
  public hasChunk(month: string): boolean {
    // 检查内存缓存
    if (this.memoryCache.has(month)) {
      return true;
    }

    // 检查 IndexedDB (异步检查)
    // 注意：这里同步返回 false，异步检查逻辑在实际使用中通过 getChunk() 触发
    return false;
  }

  /**
   * 精确范围提取
   * 从缓存中提取指定月份的指定范围数据
   */
  public async getRange(month: string, startIndex: number, endIndex: number): Promise<WallpaperData[] | null> {
    // 1. 先检查内存缓存
    const cachedData = this.memoryCache.get(month);
    if (cachedData) {
      const start = Math.max(0, startIndex);
      const end = Math.min(cachedData.wallpapers.length - 1, endIndex);
      return cachedData.wallpapers.slice(start, end + 1);
    }

    // 2. 检查IndexedDB
    const chunkData = await this.getChunkFromDB(month);
    if (chunkData) {
      const start = Math.max(0, startIndex);
      const end = Math.min(chunkData.wallpapers.length - 1, endIndex);
      return chunkData.wallpapers.slice(start, end + 1);
    }

    // 3. 如果都没有，返回 null
    return null;
  }

  /**
   * 批量检查缓存状态
   * 返回哪些月份已缓存，哪些未缓存
   */
  public getBatchCacheStatus(months: string[]): { cached: string[], uncached: string[] } {
    const cached: string[] = [];
    const uncached: string[] = [];

    for (const month of months) {
      if (this.memoryCache.has(month)) {
        cached.push(month);
      } else {
        uncached.push(month);
      }
    }

    return { cached, uncached };
  }

  /**
   * 从冷存储获取分块
   * v4.0: 增加防过期校验
   */
  private async getChunkFromDB(month: string, expectedVersion?: string): Promise<ChunkData | null> {
    if (!this.db) return null;


    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.CHUNKS_COLD], 'readonly');
      const store = transaction.objectStore(STORES.CHUNKS_COLD);


      const request = store.get(month);

      request.onsuccess = () => {
        const result = request.result;

        if (result) {
          // 校验版本号防过期机制
          if (expectedVersion && result.version !== expectedVersion) {
            
            // 异步自动清理过期缓存
            try {
              const deleteTx = this.db!.transaction([STORES.CHUNKS_COLD], 'readwrite');
              deleteTx.objectStore(STORES.CHUNKS_COLD).delete(month);
            } catch (e) {}

            resolve(null);
            return;
          }

          // v4.0: 直接返回 wallpapers 数组，包装成 ChunkData 格式
          resolve({
            schemaVersion: 2,
            month,
            version: result.version,
            updatedAt: null,
            wallpapers: result.wallpapers,
            metadata: {
              recordCount: result.wallpapers?.length || 0,
              checksum: '',
              previousHash: null
            }
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * 格式化字节数
   */

  /**
   * 添加到内存缓存（LRU管理）
   */
  private addToMemoryCache(month: string, data: ChunkData): void {
    // 超过限制时移除最久未使用的
    if (this.memoryCache.size >= CACHE_CONFIG.maxMemoryCache) {
      const lruMonth = this.accessOrder.pop();
      if (lruMonth) {
        this.memoryCache.delete(lruMonth);
      }
    }

    this.memoryCache.set(month, data);
    this.updateAccessOrder(month);
  }

  /**
   * 更新访问顺序（LRU）
   */
  private updateAccessOrder(month: string): void {
    const index = this.accessOrder.indexOf(month);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.unshift(month);
  }

  // v4.0 移除了访问统计和日志记录（v3.0 特性）

  /**
   * 获取最近的 N 个月
   */
  private getRecentMonths(currentMonth: string, count: number): string[] {
    const [year, month] = currentMonth.split('-').map(Number);
    const months: string[] = [currentMonth];

    for (let i = 1; i < count; i++) {
      let prevYear = year;
      let prevMonth = month - i;

      while (prevMonth < 1) {
        prevYear -= 1;
        prevMonth += 12;
      }

      months.push(`${prevYear}-${prevMonth.toString().padStart(2, '0')}`);
    }

    return months;
  }

  /**
   * v4.0 核心方法：按 globalIndex 范围查询 (O(log n))
   * 这是替代复杂跨月计算的新查询方式
   */
  public async getByRange(startIdx: number, endIdx: number): Promise<WallpaperData[]> {



    if (!this.db) {
      return [];
    }



    try {
      // 1. 查内存缓存 (LRU by globalIndex)
      const fromMemory = await this.getFromMemoryCache(startIdx, endIdx);


      if (fromMemory.length === (endIdx - startIdx + 1)) {
        return fromMemory;
      } else if (fromMemory.length > 0) {} else {}

      // 2. 查热存储 (扁平化，B+树范围查询)
      const fromHot = await this.getFromHotStorage(startIdx, endIdx);


      if (fromHot.length > 0) {

        // 更新内存缓存
        fromHot.forEach((wp, i) => {
          this.addToLRUCache(startIdx + i, wp);
        });

        return fromHot;
      } else {}

      // 3. 查冷存储（按需迁移）
      const fromCold = await this.getFromColdStorage(startIdx, endIdx);






      return fromCold;
    } catch (error) {

      if (error instanceof Error) {}
      return [];
    }
  }

  /**
   * v4.0：从热存储查询 (O(log n))
   * 使用 B+ 树范围查询
   * 🚀 优化：移除 _getHotStoreCount() 防御检查（该检查每次都开启额外事务）
   *    IndexedDB 的 getAll(range) 在无数据时会立即返回空数组，无需额外 count 防御
   */
  private async getFromHotStorage(startIdx: number, endIdx: number): Promise<WallpaperData[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.WALLPAPERS_HOT], 'readonly');
      const store = tx.objectStore(STORES.WALLPAPERS_HOT);

      // 利用 B+ 树范围查询 (IDBKeyRange)
      const range = IDBKeyRange.bound(startIdx, endIdx);
      const request = store.getAll(range);

      request.onsuccess = () => {
        const results = request.result || [];
        resolve(results.map(r => r.data));
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * v4.0：获取 hot storage 中的条目总数
   */
  private async _getHotStoreCount(): Promise<number> {
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.WALLPAPERS_HOT], 'readonly');
      const store = tx.objectStore(STORES.WALLPAPERS_HOT);
      const request = store.count();

      request.onsuccess = () => {
        const count = request.result;
        resolve(count);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * v4.0：从冷存储查询 + 动态迁移
   * 当查询冷数据时，将其迁移到热存储，下次更快
   * 🚀 优化：findMonthsByIndexRange / calculateRangeInChunk / getMonthIndex 全部改为同步内存查询
   */
  private async getFromColdStorage(startIdx: number, endIdx: number): Promise<WallpaperData[]> {
    if (!this.db) return [];

    // 1. 通过内存 monthIndex 找到目标月份（同步 O(N)，N 最多几十个月）
    const months = this.findMonthsByIndexRange(startIdx, endIdx);
    const results: WallpaperData[] = [];

    for (const month of months) {
      // 2. 从 chunks_cold 查询
      const chunk = await this.getChunkFromDB(month);
      if (!chunk) continue;

      // 3. 切片提取（同步内存计算范围）
      const range = this.calculateRangeInChunk(month, startIdx, endIdx);
      if (range.start <= range.end) {
        const slice = chunk.wallpapers.slice(range.start, range.end + 1);
        results.push(...slice);

        // 4. 异步迁移到热存储（带正确的索引范围）
        const monthIndex = this.getMonthIndex(month);
        if (monthIndex) {
          // 正确的全局索引范围：该月份的起始索引 + 本地偏移
          const correctGlobalStart = monthIndex.startIndex + range.start;
          const correctGlobalEnd = monthIndex.startIndex + range.end;
          const globalRange = { startIndex: correctGlobalStart, endIndex: correctGlobalEnd };
          this.migrateToHotStorage(month, slice, globalRange).catch(() => {});
        }
      }
    }

    return results;
  }

  /**
   * v4.0：通过 globalIndex 范围查找月份
   * 🚀 优化：改为 O(N) 同步内存查询，消除 IndexedDB 事务开销
   */
  private findMonthsByIndexRange(startIdx: number, endIdx: number): string[] {
    if (this.cachedMonthIndex.size === 0) return [];

    const matchingMonths: string[] = [];
    for (const [, index] of this.cachedMonthIndex) {
      if (endIdx >= index.startIndex && startIdx <= index.endIndex) {
        matchingMonths.push(index.month);
      }
    }
    return matchingMonths;
  }

  /**
   * v4.0：计算在 chunk 中的范围
   * 🚀 优化：改为同步内存查询，无需 IndexedDB 事务
   */
  private calculateRangeInChunk(month: string, globalStart: number, globalEnd: number): { start: number; end: number } {
    const monthIndex = this.cachedMonthIndex.get(month);
    if (!monthIndex) return { start: 0, end: 0 };

    const start = Math.max(0, globalStart - monthIndex.startIndex);
    const end = Math.min(monthIndex.recordCount - 1, globalEnd - monthIndex.startIndex);
    return { start, end };
  }

  /**
   * v4.0：获取指定月份的索引信息
   * 🚀 优化：改为同步内存查询，无需 IndexedDB 事务
   */
  private getMonthIndex(month: string): MonthIndexRecord | null {
    return this.cachedMonthIndex.get(month) ?? null;
  }

  /**
   * v4.0：将冷数据迁移到热存储
   * 🚀 优化 1：从内存获取 globalIndex 范围，无需额外事务
   * 🚀 优化 2：将 cleanupHotStorage 的删除操作与写入合并到同一个 readwrite 事务
   */
  private async migrateToHotStorage(month: string, wallpapers: WallpaperData[], globalIndexRange?: { startIndex: number; endIndex: number }): Promise<void> {
    if (!this.db || wallpapers.length === 0) return;

    // 计算正确的全局索引范围（同步内存查询）
    let startGlobalIndex: number;
    if (globalIndexRange) {
      startGlobalIndex = globalIndexRange.startIndex;
    } else {
      const idx = this.cachedMonthIndex.get(month);
      if (!idx) return;
      startGlobalIndex = idx.startIndex;
    }

    // 🚀 合并 cleanup + write 到同一个事务，避免额外事务开销
    return new Promise(async (resolve, reject) => {
      try {
        // 先检查是否需要清理空间（仍需一次 count）
        const currentCount = await this._getHotStoreCount();
        const overload = (currentCount + wallpapers.length) - CACHE_CONFIG.maxHotEntries;

        const tx = this.db!.transaction([STORES.WALLPAPERS_HOT], 'readwrite');
        const store = tx.objectStore(STORES.WALLPAPERS_HOT);

        // 如果超载，用同一事务的游标删除旧数据
        if (overload > 0) {
          const deleteLimit = overload + Math.floor(CACHE_CONFIG.maxHotEntries * 0.1);
          const index = store.index('cachedAt');
          let deleted = 0;

          await new Promise<void>((resolveCursor, rejectCursor) => {
            const cursorRequest = index.openCursor(); // 升序（最旧的在前）
            cursorRequest.onsuccess = (event) => {
              const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
              if (cursor && deleted < deleteLimit) {
                cursor.delete();
                deleted++;
                cursor.continue();
              } else {
                resolveCursor();
              }
            };
            cursorRequest.onerror = () => rejectCursor(cursorRequest.error);
          });
        }

        // 在同一事务中批量写入新数据
        const cachedAt = new Date().toISOString();
        wallpapers.forEach((wallpaper, i) => {
          store.put({
            globalIndex: startGlobalIndex + i,
            id: wallpaper.id,
            month,
            localIndex: i,
            data: wallpaper,
            cachedAt,
          });
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * v4.0：从内存缓存查询 (LRU by globalIndex)
   * 🚀 优化：O(1) LRU 刷新（delete+set 利用 Map 插入顺序）
   */
  private getFromMemoryCache(startIdx: number, endIdx: number): WallpaperData[] {
    const results: WallpaperData[] = [];

    for (let i = startIdx; i <= endIdx; i++) {
      const cached = this.lruCache.get(i);
      if (cached) {
        results.push(cached);
        // O(1) LRU 刷新：delete 后 set 使其变为 Map 中最新插入（队尾）
        this.lruCache.delete(i);
        this.lruCache.set(i, cached);
      } else {
        // LRU 未命中，返回到此为止的结果
        break;
      }
    }

    return results;
  }

  /**
   * v4.0：添加到 LRU 缓存
   * 🚀 优化：O(1) 淘汰（Map.keys().next().value 永远是最旧的键）
   */
  private addToLRUCache(globalIndex: number, wallpaper: WallpaperData): void {
    if (this.lruCache.has(globalIndex)) {
      // 已存在：先删除使其移到队尾
      this.lruCache.delete(globalIndex);
    } else if (this.lruCache.size >= CACHE_CONFIG.maxMemoryCache) {
      // 超容量：淘汰队首（最旧的）
      const oldestKey = this.lruCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.lruCache.delete(oldestKey);
      }
    }
    this.lruCache.set(globalIndex, wallpaper);
  }

  /**
   * v4.0：纯 v4.0 架构
   */
  public isV4Mode(): boolean {
    return true;
  }

  /**
   * v4.0：获取缓存状态
   */
  public getCacheStatus() {
    return {
      // 内存缓存（按月）
      memoryCache: {
        size: this.memoryCache.size,
        max: CACHE_CONFIG.maxMemoryCache,
        months: Array.from(this.memoryCache.keys())
      },
      accessOrder: [...this.accessOrder],

      // LRU 缓存（按 globalIndex）
      lruCache: {
        size: this.lruCache.size,
        max: CACHE_CONFIG.maxMemoryCache,
        globalIndexes: Array.from(this.lruCache.keys())
      },

      config: CACHE_CONFIG
    };
  }

  /**
   * v4.0：计算全局索引范围
   * 🚀 优化：改为同步内存查询
   */
  private calculateGlobalIndexRange(month: string, recordCount: number): { startIndex: number; endIndex: number } {
    // 如果该月份已在内存索引中，直接复用
    const existing = this.cachedMonthIndex.get(month);
    if (existing) {
      return { startIndex: existing.startIndex, endIndex: existing.endIndex };
    }

    // 新月份：按插入顺序（旧→新）累加计算起始索引
    const allIndexes = Array.from(this.cachedMonthIndex.values()).sort(
      (a, b) => a.month.localeCompare(b.month)
    );
    let cumulativeIndex = 0;
    for (const index of allIndexes) {
      cumulativeIndex += index.recordCount;
    }
    return { startIndex: cumulativeIndex, endIndex: cumulativeIndex + recordCount - 1 };
  }




  /**
   * v4.0：构建月份索引
   * 写入 DB 后同步更新内存镜像
   */
  private async buildMonthIndex(month: string, startIndex: number, endIndex: number, recordCount: number): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.MONTH_INDEX], 'readwrite');
      const store = transaction.objectStore(STORES.MONTH_INDEX);

      const monthIndexRecord = {
        month,
        startIndex,
        endIndex,
        recordCount,
        createdAt: new Date().toISOString()
      };

      const request = store.put(monthIndexRecord);

      request.onsuccess = () => {
        // 同步更新内存镜像
        this.cachedMonthIndex.set(month, { month, startIndex, endIndex, recordCount });
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// 导出单例实例
export const dbManager = new DBManager();
