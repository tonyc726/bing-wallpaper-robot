/**
 * 缓存协同 - 发布订阅器
 * 负责 SW 预取完成后通知 UI 更新
 */

type CacheUpdateCallback = (data: {
  type: 'chunk-downloaded' | 'prefetch-complete' | 'cache-updated';
  month?: string;
  months?: string[];
  cacheStatus?: unknown;
}) => void;

class CacheNotifier {
  private subscribers: Set<CacheUpdateCallback> = new Set();

  /**
   * 订阅缓存更新
   */
  public subscribe(callback: CacheUpdateCallback): () => void {
    this.subscribers.add(callback);

    // 返回取消订阅函数
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * 取消订阅
   */
  public unsubscribe(callback: CacheUpdateCallback): void {
    this.subscribers.delete(callback);
  }

  /**
   * 通知订阅者 - 分块下载完成
   */
  public notifyChunkDownloaded(month: string): void {

    this.subscribers.forEach(callback => {
      try {
        callback({
          type: 'chunk-downloaded',
          month
        });
      } catch (error) {
      }
    });
  }

  /**
   * 通知订阅者 - 预取完成
   */
  public notifyPrefetchComplete(months: string[]): void {

    this.subscribers.forEach(callback => {
      try {
        callback({
          type: 'prefetch-complete',
          months
        });
      } catch (error) {
      }
    });
  }

  /**
   * 通知订阅者 - 缓存更新
   */
  public notifyCacheUpdated(cacheStatus: unknown): void {

    this.subscribers.forEach(callback => {
      try {
        callback({
          type: 'cache-updated',
          cacheStatus
        });
      } catch (error) {
      }
    });
  }

  /**
   * 清空所有订阅
   */
  public clear(): void {
    this.subscribers.clear();
  }

  /**
   * 获取订阅者数量
   */
  public getSubscriberCount(): number {
    return this.subscribers.size;
  }
}

// 导出单例实例
export const cacheNotifier = new CacheNotifier();
