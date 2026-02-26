const BASE = "https://cn.bing.com/th?id=";
export const imageUrl = (id) => `${BASE}${id}_UHD.jpg&w=300&c=1`;
export const downloadUrl = (id) => `${BASE}${id}_UHD.jpg`;
export const dateFmt = (date) => {
  const s = String(date);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
};
