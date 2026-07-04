/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// 七牛冷备份域名（可选）。仅当配置后，前端图片降级链才会启用七牛兜底层。
interface ImportMetaEnv {
  readonly VITE_QINIU_DOMAIN?: string;
}

interface Navigator {
  standalone?: boolean;
}



interface Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}
