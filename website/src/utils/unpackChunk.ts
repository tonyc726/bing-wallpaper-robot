import type { WallpaperData } from '../types';

const BASE = "https://cn.bing.com/th?id=";
export const imageUrl = (id: string) => `${BASE}${id}_UHD.jpg&w=600&c=1`;
export const downloadUrl = (id: string) => `${BASE}${id}_UHD.jpg`;
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
