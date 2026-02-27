export type ColorCategory = 
  | '红色系' 
  | '橙色系' 
  | '黄色系' 
  | '绿色系' 
  | '青色系' 
  | '蓝色系' 
  | '紫色系' 
  | '粉色系' 
  | '无彩色 (黑白灰)';

// eslint-disable-next-line complexity
export function getHexColorCategory(hexStr: string): ColorCategory {
  let hex = hexStr.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  
  h = Math.round(h * 360);
  
  // 饱和度太低或是明度极端的，都归为无彩色
  if (s < 0.1 || l < 0.1 || l > 0.95) {
    return '无彩色 (黑白灰)';
  }
  
  if (h >= 0 && h < 15) return '红色系';
  if (h >= 15 && h < 45) return '橙色系';
  if (h >= 45 && h < 70) return '黄色系';
  if (h >= 70 && h < 160) return '绿色系';
  if (h >= 160 && h < 190) return '青色系';
  if (h >= 190 && h < 260) return '蓝色系';
  if (h >= 260 && h < 310) return '紫色系';
  if (h >= 310 && h < 345) return '粉色系';
  
  return '红色系';
}

export const COLOR_ORDER: ColorCategory[] = [
  '红色系',
  '橙色系',
  '黄色系',
  '绿色系',
  '青色系',
  '蓝色系',
  '紫色系',
  '粉色系',
  '无彩色 (黑白灰)',
];
