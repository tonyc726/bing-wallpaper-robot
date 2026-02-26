/**
 * Service Worker 注册与管理 (基于 vite-plugin-pwa)
 */
import { registerSW } from 'virtual:pwa-register';

class SWRegister {
  private updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

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
        onNeedRefresh() {
          console.log('[SW] New content available, prompting for refresh...');
          // 可以触发一个全局的 UI 提示用户刷新
          if (confirm('发现新版本或新数据，是否刷新页面以应用？')) {
            window.location.reload();
          }
        },
        onOfflineReady() {
          console.log('[SW] App is ready to work offline');
        },
        onRegisteredSW(swUrl, registration) {
          console.log('[SW] Registered successfully:', swUrl, registration);
        },
        onRegisterError(error) {
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
