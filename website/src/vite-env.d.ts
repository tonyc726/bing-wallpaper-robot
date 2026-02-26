/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

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
