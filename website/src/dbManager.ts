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
const DB_VERSION = 5;

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
  maxDBCache: 24,              // IndexedDB缓存最多24个月
  cleanupInterval: 24 * 60 * 60 * 1000,  // 24小时清理一次

  // 热冷分层阈值
  hotMonthsThreshold: 6,       // 最近6个月为热数据
} as const;

class DBManager {
  private db: IDBDatabase | null = null;

  // v3.0 兼容：按月份的内存缓存
  private memoryCache = new Map<string, ChunkData>();
  private accessOrder: string[] = [];

  // v4.0 新增：按 globalIndex 的 LRU 缓存
  private lruCache = new Map<number, WallpaperData>();  // globalIndex -> WallpaperData
  private lruOrder: number[] = [];  // 访问顺序

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

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
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
          newStores.push(STORES.WALLPAPERS_HOT);
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
        this.lruOrder = [];
        
        console.log('[DB Cache] 🗑️ All data successfully cleared built-in db reset.');
        resolve();
      };
      
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * v4.0：从现有的 chunks 重建 monthIndex
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


          cumulativeIndex = endIndex + 1;
        }


        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };

      getAllRequest.onerror = () => reject(getAllRequest.error);
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
   * 当发现索引错误时调用此方法修复
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

          // 先清空旧的索引
          writeStore.clear();

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

            cumulativeIndex += recordCount;
          });

          writeTx.oncomplete = () => {
            resolve();
          };

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
        this.lruOrder = [];

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
   */
  private async getFromHotStorage(startIdx: number, endIdx: number): Promise<WallpaperData[]> {
    if (!this.db) return [];

    // 🔍 调试：先检查 hot storage 总量
    const hotStoreCount = await this._getHotStoreCount();

    if (hotStoreCount === 0) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.WALLPAPERS_HOT], 'readonly');
      const store = tx.objectStore(STORES.WALLPAPERS_HOT);

      // 利用 B+ 树范围查询 (IDBKeyRange)
      const range = IDBKeyRange.bound(startIdx, endIdx);
      const request = store.getAll(range);

      request.onsuccess = () => {
        const results = request.result || [];
        const wallpapers = results.map(r => r.data);
        if (wallpapers.length > 0) {}
        resolve(wallpapers);
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
   */
  private async getFromColdStorage(startIdx: number, endIdx: number): Promise<WallpaperData[]> {
    if (!this.db) return [];

    // 1. 通过 monthIndex 找到目标月份
    const months = await this.findMonthsByIndexRange(startIdx, endIdx);
    const results: WallpaperData[] = [];

    for (const month of months) {
      // 2. 从 chunks_cold 查询
      const chunk = await this.getChunkFromDB(month);
      if (!chunk) continue;

      // 3. 切片提取 (异步计算范围)
      const range = await this.calculateRangeInChunk(month, startIdx, endIdx);
      if (range.start <= range.end) {
        const slice = chunk.wallpapers.slice(range.start, range.end + 1);
        results.push(...slice);

        // 4. 异步迁移到热存储（带正确的索引范围）
        // 需要计算该月份在全局索引中的正确起始位置
        const monthIndex = await this.getMonthIndex(month);
        if (monthIndex) {
          // 正确的全局索引范围：该月份的起始索引 + 本地偏移
          const correctGlobalStart = monthIndex.startIndex + range.start;
          const correctGlobalEnd = monthIndex.startIndex + range.end;
          const globalRange = { startIndex: correctGlobalStart, endIndex: correctGlobalEnd };
          this.migrateToHotStorage(month, slice, globalRange).catch(() => {});
        } else {}
      }
    }

    return results;
  }

  /**
   * v4.0：通过 globalIndex 范围查找月份
   */
  private async findMonthsByIndexRange(startIdx: number, endIdx: number): Promise<string[]> {
    if (!this.db) return [];

    // 重试机制：最多3次，避免v4.0查询初期空结果问题
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const months = await this._findMonthsInternal(startIdx, endIdx);
        if (months.length > 0 || attempt === 3) {
          return months;
        } else {
          // 递增延迟：50ms, 100ms
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        }
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * attempt));
      }
    }
    return [];
  }

  private async _findMonthsInternal(startIdx: number, endIdx: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.MONTH_INDEX], 'readonly');
      const store = tx.objectStore(STORES.MONTH_INDEX);
      const request = store.getAll();

      request.onsuccess = () => {
        const allIndexes = request.result || [];

        if (allIndexes.length > 0) {}

        const matchingMonths: string[] = [];
        const unmatchedRanges: { month: string; indexRange: string; queryRange: string }[] = [];

        for (const index of allIndexes) {
          // 检查是否有重叠
          const hasOverlap = endIdx >= index.startIndex && startIdx <= index.endIndex;

          if (hasOverlap) {
            matchingMonths.push(index.month);
          } else {
            unmatchedRanges.push({
              month: index.month,
              indexRange: `[${index.startIndex}, ${index.endIndex}]`,
              queryRange: `[${startIdx}, ${endIdx}]`
            });
          }
        }


        resolve(matchingMonths);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * v4.0：计算在 chunk 中的范围
   * 根据 globalIndex 范围和 monthIndex，计算在该月份中的本地范围
   */
  private async calculateRangeInChunk(month: string, globalStart: number, globalEnd: number): Promise<{ start: number; end: number }> {
    if (!this.db) return { start: 0, end: 0 };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.MONTH_INDEX], 'readonly');
      const store = tx.objectStore(STORES.MONTH_INDEX);
      const request = store.get(month);

      request.onsuccess = () => {
        const monthIndex = request.result;
        if (!monthIndex) {
          resolve({ start: 0, end: 0 });
          return;
        }

        // 计算在该月份中的范围
        const start = Math.max(0, globalStart - monthIndex.startIndex);
        const end = Math.min(monthIndex.recordCount - 1, globalEnd - monthIndex.startIndex);

        resolve({ start, end });
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * v4.0：获取指定月份的索引信息
   */
  private async getMonthIndex(month: string): Promise<{ startIndex: number; endIndex: number; recordCount: number } | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction([STORES.MONTH_INDEX], 'readonly');
      const store = tx.objectStore(STORES.MONTH_INDEX);
      const request = store.get(month);

      request.onsuccess = () => {
        const monthIndex = request.result;
        if (monthIndex) {
          resolve({
            startIndex: monthIndex.startIndex,
            endIndex: monthIndex.endIndex,
            recordCount: monthIndex.recordCount
          });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * v4.0：将冷数据迁移到热存储
   * @param month 月份
   * @param wallpapers 壁纸数据
   * @param globalIndexRange 可选的全局索引范围，如果传入则使用该范围，否则从 monthIndex 计算
   */
  private async migrateToHotStorage(month: string, wallpapers: WallpaperData[], globalIndexRange?: { startIndex: number; endIndex: number }): Promise<void> {
    if (!this.db || wallpapers.length === 0) return;


    // 计算正确的全局索引范围
    let startGlobalIndex: number;

    if (globalIndexRange) {
      // 如果传入了范围，直接使用
      startGlobalIndex = globalIndexRange.startIndex;
    } else {
      // 从 monthIndex 获取正确的索引
      const range = await this.calculateRangeInChunkForMigration(month);
      if (!range) {
        return;
      }
      startGlobalIndex = range.start;
    }


    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.WALLPAPERS_HOT], 'readwrite');
      const store = tx.objectStore(STORES.WALLPAPERS_HOT);

      // 批量添加，使用正确的 globalIndex
      wallpapers.forEach((wallpaper, i) => {
        store.put({
          globalIndex: startGlobalIndex + i,
          id: wallpaper.id,
          month: month,
          localIndex: i,
          data: wallpaper,
          cachedAt: new Date().toISOString()
        });
      });

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  }

  /**
   * v4.0：为迁移计算正确的全局索引范围
   */
  private async calculateRangeInChunkForMigration(month: string): Promise<{ start: number; end: number } | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction([STORES.MONTH_INDEX], 'readonly');
      const store = tx.objectStore(STORES.MONTH_INDEX);
      const request = store.get(month);

      request.onsuccess = () => {
        const monthIndex = request.result;
        if (monthIndex) {
          resolve({ start: monthIndex.startIndex, end: monthIndex.endIndex });
        } else {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
    });
  }

  /**
   * v4.0：从内存缓存查询 (LRU by globalIndex)
   */
  private async getFromMemoryCache(startIdx: number, endIdx: number): Promise<WallpaperData[]> {
    const results: WallpaperData[] = [];

    for (let i = startIdx; i <= endIdx; i++) {
      const cached = this.lruCache.get(i);
      if (cached) {
        results.push(cached);
        this.updateLRUOrder(i);
      } else {
        // LRU 未命中，返回到此为止的结果
        break;
      }
    }

    return results;
  }

  /**
   * v4.0：添加到 LRU 缓存
   */
  private addToLRUCache(globalIndex: number, wallpaper: WallpaperData): void {
    // 超过限制时移除最久未使用的
    if (this.lruCache.size >= CACHE_CONFIG.maxMemoryCache) {
      const lruIndex = this.lruOrder.pop();
      if (lruIndex !== undefined) {
        this.lruCache.delete(lruIndex);
      }
    }

    this.lruCache.set(globalIndex, wallpaper);
    this.updateLRUOrder(globalIndex);
  }

  /**
   * v4.0：更新 LRU 访问顺序
   */
  private updateLRUOrder(globalIndex: number): void {
    const index = this.lruOrder.indexOf(globalIndex);
    if (index > -1) {
      this.lruOrder.splice(index, 1);
    }
    this.lruOrder.unshift(globalIndex);
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
   * 根据月份和记录数，计算在全局索引中的范围
   * 核心原则：按月份时间顺序（从旧到新）累加索引
   */
  private async calculateGlobalIndexRange(month: string, recordCount: number): Promise<{ startIndex: number; endIndex: number }> {
    // 策略：基于月份顺序计算
    // 从 metadata 中获取所有已存储的月份及其记录数
    if (!this.db) return { startIndex: 0, endIndex: recordCount - 1 };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction([STORES.MONTH_INDEX], 'readonly');
      const store = tx.objectStore(STORES.MONTH_INDEX);
      const request = store.getAll();

      request.onsuccess = () => {
        const allIndexes = request.result || [];

        // ✅ 修复：按月份时间顺序排序（从旧到新），而不是按 startIndex
        allIndexes.sort((a, b) => a.month.localeCompare(b.month));


        // 计算累计索引
        let cumulativeIndex = 0;

        for (const index of allIndexes) {
          if (index.month === month) {
            // 理论上这个月份应该已经存在，如果有则报错
            resolve({ startIndex: index.startIndex, endIndex: index.endIndex });
            return;
          }

          // 累加前一个月份的记录数
          cumulativeIndex += index.recordCount;
        }

        // 如果没有找到该月份，说明是新月份
        const startIndex = cumulativeIndex;
        const endIndex = startIndex + recordCount - 1;

        resolve({ startIndex, endIndex });
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * v4.0：构建月份索引
   * 为 v4.0 的 getByRange() 方法提供月份范围映射
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
