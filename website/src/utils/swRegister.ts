/**
 * Service Worker 注册与管理 (基于 vite-plugin-pwa)
 */
import { registerSW } from 'virtual:pwa-register';

class SWRegister {
  private updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  public getUpdateWorker() {
    return this.updateSW;
  }

  /**
   * 注册 Service Worker
   */
  public async register(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[SW] Service Worker not supported');
      return;
    }

    if (import.meta.env.DEV) {
      console.log('[SW] Skipping Service Worker registration in dev mode');
      return;
    }

    try {
      this.updateSW = registerSW({
        onNeedRefresh: () => {
          console.log('[SW] New content available, dispatching update event');
          // 发送自定义事件，让 UI 层显示非侵入式提示（如 Snackbar）
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        },
        onOfflineReady: () => {
          console.log('[SW] App is ready to work offline');
        },
        onRegisteredSW: (_swUrl, registration) => {
          console.log('[SW] Registered successfully:', _swUrl, registration);
          if (registration) {
            // 清理旧的定时器（防止重复注册产生多个定时器）
            if (this.intervalId) {
              clearInterval(this.intervalId);
            }

            // 每小时检查一次更新
            this.intervalId = setInterval(() => {
              console.log('[SW] Polling for updates...');
              registration.update();
            }, 60 * 60 * 1000);
          }
        },
        onRegisterError: (error) => {
          console.error('[SW] Registration failed:', error);
        }
      });
    } catch (error) {
      console.error('[SW] ❌ Unexpected Registration error:', error);
    }
  }

  /**
   * 检查是否支持 Service Worker
   */
  public isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }
}

// 导出单例实例
export const swRegister = new SWRegister();
