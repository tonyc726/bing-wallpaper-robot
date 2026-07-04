import type { WallpaperData } from '../types';

const BASE = "https://cn.bing.com/th?id=";
export const imageUrl = (id: string) => `${BASE}${id}_UHD.jpg&w=300&c=1`;
export const downloadUrl = (id: string) => `${BASE}${id}_UHD.jpg`;

// 七牛冷备份域名（仅当 .env 配置了 VITE_QINIU_DOMAIN 时启用）。
// 常态为空字符串 → backupUrl 返回 ''，前端降级链自动跳过七牛层，
// 行为与今日完全一致（inert until configured），不改变现有部署表现。
const RAW_QINIU_DOMAIN = (import.meta.env.VITE_QINIU_DOMAIN || '').trim().replace(/\/+$/, '');
// 补全协议头：未显式带 http(s):// 时默认 https。
// 生产站点为 HTTPS，若备份图走 http 会被浏览器「混合内容」策略拦截，
// 故要求七牛侧绑定支持 HTTPS 的自定义 CDN 域名（默认 .clouddn.com 仅 HTTP，不可用于线上兜底）。
const QINIU_ORIGIN = RAW_QINIU_DOMAIN
  ? (/^https?:\/\//i.test(RAW_QINIU_DOMAIN) ? RAW_QINIU_DOMAIN : `https://${RAW_QINIU_DOMAIN}`)
  : '';

/**
 * 七牛冷备份兜底 URL。仅在 Bing 源头失效时，由组件 onError 逐级降级调用。
 * key 契约与后端 crawler/utils/upload-to-qiniu.ts 严格对齐：bing-wallpaper/${id}.jpg
 * 前提：七牛桶需为【公开空间】且域名支持 HTTPS，否则浏览器读取会 401 / 被拦截。
 * @returns 配置了域名则返回完整 URL，否则返回 '' 表示"当前无备份层"。
 */
export const backupUrl = (id: string): string =>
  QINIU_ORIGIN ? `${QINIU_ORIGIN}/bing-wallpaper/${id}.jpg` : '';
export const dateFmt = (date: number) => {
  const s = String(date);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};

/**
 * Converts a compact array row from the NPM package to a full WallpaperData object
 * Compact Format: [id, date, title, copyright, dominantColor]
 */
export function unpackChunkRow(row: any[]): WallpaperData {
  const id = row[0];
  const date = row[1];
  return {
    id,
    date,
    dateFmt: dateFmt(date),
    title: row[2] || null,
    copyright: row[3] || null,
    dominantColor: row[4] || 'cccccc',
    imageUrl: imageUrl(id),
    downloadUrl: downloadUrl(id)
  };
}

export function unpackChunk(compactRows: any[][]): WallpaperData[] {
  return compactRows.map(unpackChunkRow);
}
