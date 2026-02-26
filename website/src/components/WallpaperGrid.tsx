import * as React from 'react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useQueryState } from 'nuqs';
import {
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Box,
  Typography,
  InputAdornment,
  Paper,
  Tooltip,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import GitHubIcon from '@mui/icons-material/GitHub';
import WallpaperCard from './WallpaperCard';
import type { WallpaperData, WallpapersGroupData, IndexData } from '../types';

interface Props {
  data: WallpapersGroupData[];
  onImageClick: (wallpaper: WallpaperData) => void;
  favorites: Set<string>;
  onToggleFavorite: (wallpaper: WallpaperData) => void;
  indexData: IndexData | null;
  loadingMonths: Set<string>;
  loadMonthData: (month: string) => Promise<void>;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeSharedId?: string | null;
}

const ITEMS_PER_PAGE = 24;

// 提取单个月份模块，便于独立拥有 IntersectionObserver 逻辑
const MonthSection: React.FC<{
  group: WallpapersGroupData;
  loading: boolean;
  loadMonthData: (month: string) => void;
  onImageClick: (wallpaper: WallpaperData) => void;
  favorites: Set<string>;
  onToggleFavorite: (wallpaper: WallpaperData) => void;
}> = React.memo(({ group, loading, loadMonthData, onImageClick, favorites, onToggleFavorite }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    // 只有在数据未加载且不在 loading 中才观测
    if (group.wallpapers.length > 0 || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMonthData(group.groupMonth);
        }
      },
      { rootMargin: '400px' } // 提前 400px 触发
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [group.groupMonth, group.wallpapers.length, loading, loadMonthData]);

  // 如果没有数据，渲染骨架屏
  const isSkeleton = group.wallpapers.length === 0;
  const renderCount = isSkeleton ? (group.totalCount || 0) : group.wallpapers.length;

  if (renderCount === 0) return null;

  return (
    <Box ref={containerRef} sx={{ mb: { xs: 8, md: 12 }, position: 'relative' }}>
        {/* 幽灵表头 (Ghost Header) - 悬浮在背景之上的巨大空灵文字 */}
      <Typography
        variant="h1" // 使用巨大的 h1
        id={`month-${group.groupMonth.replace('年', '-').replace('月', '')}`}
        sx={{
          position: 'absolute',
          top: { xs: -30, md: -60 }, // 错位向上偏移，打破网格束缚
          left: { xs: 16, md: 32 },
          zIndex: 0, // 沉在图片底部或仅作为水印
          fontWeight: 900,
          color: 'transparent',
          WebkitTextStroke: `1px ${alpha(theme.palette.text.primary, 0.15)}`, // 空心字效果
          letterSpacing: '-0.04em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          textTransform: 'uppercase',
          fontSize: { xs: '4rem', sm: '6rem', md: '10rem' },
          lineHeight: 0.8,
          opacity: 0,
          animation: 'headerReveal 1s cubic-bezier(0.165, 0.84, 0.44, 1) forwards',
          '@keyframes headerReveal': {
            '0%': { opacity: 0, transform: 'translateY(100px)' },
            '100%': { opacity: 1, transform: 'translateY(0)' }
          }
        }}
      >
        {group.groupMonth.replace('年', '.').replace('月', '')}
      </Typography>

      {/* 针对屏幕阅读器和粘性导视的幽灵悬浮标签 */}
      <Typography
        variant="h6"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100, // 高于图片
          py: 2,
          px: { xs: 2, md: 4 },
          fontWeight: 700,
          color: theme.palette.text.primary,
          // 极致的融合渐变：只在文字背后有一层极其微弱的遮罩
          background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0.8)} 0%, ${alpha(theme.palette.background.default, 0)} 100%)`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          pointerEvents: 'none', // 不阻挡底层图片的交互
          textShadow: `0 2px 12px ${theme.palette.background.default}`, // 增加文字清晰度
        }}
      >
        {group.groupMonth}
      </Typography>

      {/* Ultra High Density Grid (0-2px Gutter, Edge-to-Edge) */}
      <Grid
        container
        spacing={{ xs: 0, md: 0.25 }} // 移动端 0 缝隙，PC 2px
        sx={{ px: 0, zIndex: 1, position: 'relative' }} // 彻底去除两边 padding
      >
        {/* 骨架屏或内容映射 */}
        {isSkeleton ? (
          Array.from({ length: renderCount }).map((_, i) => (
            <Grid 
              item 
              xs={6} sm={4} md={3} lg={2} xl={1.5} 
              key={`skeleton-${group.groupMonth}-${i}`}
            >
              <Box sx={{ paddingTop: '56.25%', position: 'relative', width: '100%', bgcolor: alpha(theme.palette.text.primary, 0.04), overflow: 'hidden' }}>
                <Box 
                  sx={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.5 },
                      '50%': { opacity: 0.8 },
                    }
                  }} 
                />
              </Box>
            </Grid>
          ))
        ) : (
          group.wallpapers.map((wallpaper, index) => (
            <Grid
              item 
              xs={6} sm={4} md={3} lg={2} xl={1.5} 
              key={wallpaper.id}
            >
              <Box
                sx={{ 
                  height: '100%',
                  opacity: 0,
                  animation: 'cardReveal 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards',
                  animationDelay: `${(index % 12) * 0.05}s`,
                  '@keyframes cardReveal': {
                    '0%': { opacity: 0, transform: 'translateY(40px) scale(0.95)' },
                    '100%': { opacity: 1, transform: 'translateY(0) scale(1)' }
                  }
                }}
              >
                <WallpaperCard
                  wallpaper={wallpaper}
                  onImageClick={onImageClick}
                  isFavorite={favorites.has(wallpaper.id)}
                  onToggleFavorite={onToggleFavorite}
                />
              </Box>
            </Grid>
          ))
        )}
      </Grid>
    </Box>
  );
}, (prevProps, nextProps) => {
  if (prevProps.group.groupMonth !== nextProps.group.groupMonth) return false;
  if (prevProps.loading !== nextProps.loading) return false;
  
  // Custom check for favorites: only re-render if a wallpaper IN THIS GROUP changed favorite status 
  // (Prevents entire Timeline from re-rendering when one image is favorited)
  const prevFavs = prevProps.favorites;
  const nextFavs = nextProps.favorites;
  for (const w of prevProps.group.wallpapers) {
    if (prevFavs.has(w.id) !== nextFavs.has(w.id)) {
      return false;
    }
  }
  return true;
});

// eslint-disable-next-line complexity
const WallpaperGrid: React.FC<Props> = ({
  data,
  onImageClick,
  favorites,
  onToggleFavorite,
  loadingMonths,
  loadMonthData,
  darkMode,
  setDarkMode,
}) => {
  const theme = useTheme();

  // === URL 状态管理 ===
  const [searchTerm, setSearchTerm] = useQueryState('q');
  const [sortBy, setSortBy] = useQueryState('sort', {
    defaultValue: 'date-desc',
  });
  
  // 解决输入卡顿：使用本地状态加上防抖延迟，防止频繁重新过滤导致浏览器线程阻塞
  const [localSearch, setLocalSearch] = useState(searchTerm || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      const val = localSearch || null;
      if (searchTerm !== val) {
        setSearchTerm(val);
      }
    }, 400); // 400ms 毫秒防抖
    return () => clearTimeout(timer);
  }, [localSearch, searchTerm, setSearchTerm]);

  useEffect(() => {
    // 处理从 URL 外部返回带来的更新
    if (searchTerm !== localSearch && (searchTerm || '') !== localSearch) {
      setLocalSearch(searchTerm || '');
    }
  }, [searchTerm, localSearch]);
  const [selectedYear] = useQueryState('year', {
    defaultValue: 'all',
    parse: (value) => value || 'all',
    serialize: (value) => value || 'all',
  });
  const [showFavoritesOnly, setShowFavoritesOnly] = useQueryState('fav', {
    parse: Boolean,
    defaultValue: false,
  });

  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadingRef = useRef<HTMLDivElement>(null);

  // === 第一步：全量数据提取与去重 ===
  const allWallpapers = useMemo(() => {
    const flat = data.flatMap((group) => group.wallpapers);
    const uniqueMap = new Map<string, WallpaperData>();
    flat.forEach((w) => {
      if (!uniqueMap.has(w.id)) {
        uniqueMap.set(w.id, w);
      }
    });
    return Array.from(uniqueMap.values());
  }, [data]);

  // === 第二步：过滤 ===
  const filteredWallpapers = useMemo(() => {
    let result = allWallpapers;

    // 收藏过滤
    const showFav = showFavoritesOnly ?? false;
    if (showFav) {
      result = result.filter((w) => favorites.has(w.id));
    }

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (w) =>
          w.copyright?.toLowerCase().includes(term) ||
          w.id.toLowerCase().includes(term) ||
          w.title?.toLowerCase().includes(term),
      );
    }

    // (可选的) 年份过滤，隐藏在底层，供特殊的URL直达使用
    const year = selectedYear ?? 'all';
    if (year !== 'all') {
      const yearNum = parseInt(year, 10);
      result = result.filter((w) => {
        const wallpaperYear = Math.floor(w.date / 10000);
        return wallpaperYear === yearNum;
      });
    }

    return result;
  }, [allWallpapers, selectedYear, showFavoritesOnly, searchTerm, favorites]);

  // === 第三步：排序 ===
  const sortedWallpapers = useMemo(() => {
    const result = [...filteredWallpapers];
    const sortKey = sortBy ?? 'date-desc';
    result.sort((a, b) => {
      switch (sortKey) {
        case 'date-asc':
          return a.date - b.date; // 最旧
        case 'date-desc':
          return b.date - a.date; // 最新
        case 'color':
          return a.dominantColor.localeCompare(b.dominantColor);
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return b.date - a.date;
      }
    });
    return result;
  }, [filteredWallpapers, sortBy]);

  // === 第四步：截取当前可见数量 (Client Pagination) ===
  const visibleWallpapers = sortedWallpapers.slice(0, visibleCount);

  // === 第五步：按年月分组 (Group by Month for Timeline/Headers) ===
  const groupedData = useMemo(() => {
    const groups: { monthStr: string; items: WallpaperData[] }[] = [];
    let currentGroupMonth = '';
    let currentItems: WallpaperData[] = [];

    // 对于普通排序（不是按日期排的时候），可能不需要强行分组，但为了Google Photos风格，
    // 如果是按颜色或标题排序，全挤在一个 "全部" 下面也是一种选择。
    // 这里如果按 date-desc/date-asc 排序，就按自然月切分。否则并作一组。
    const isDateSort = (sortBy ?? 'date-desc').startsWith('date');

    visibleWallpapers.forEach((w) => {
      const year = Math.floor(w.date / 10000);
      const month = Math.floor((w.date % 10000) / 100);
      const mm = month < 10 ? `0${month}` : `${month}`;
      const monthStr = isDateSort ? `${year}年${mm}月` : '已排序壁纸';

      if (monthStr !== currentGroupMonth) {
        if (currentItems.length > 0) {
          groups.push({ monthStr: currentGroupMonth, items: currentItems });
        }
        currentGroupMonth = monthStr;
        currentItems = [w];
      } else {
        currentItems.push(w);
      }
    });

    if (currentItems.length > 0) {
      groups.push({ monthStr: currentGroupMonth, items: currentItems });
    }

    return groups;
  }, [visibleWallpapers, sortBy]);

  // 判断是否处于纯净的时间线模式（无过滤，按时间倒序）
  const isTimelineMode = !searchTerm && !showFavoritesOnly && (sortBy === 'date-desc') && selectedYear === 'all';

  // === 状态重置 ===
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchTerm, sortBy, selectedYear, showFavoritesOnly]);

  // === 无限滚动侦听 ===
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisibleCount((prev: number) => Math.min(prev + ITEMS_PER_PAGE, sortedWallpapers.length));
        }
      },
      {
        threshold: 0.5,
        rootMargin: '200px', // 提前点触发
      },
    );

    if (loadingRef.current) observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [sortedWallpapers.length]);

  return (
    <Box>
      {/* 沉浸式灵动胶囊过滤栏 (Dynamic Capsule) */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: 16, md: 24 }, // 移动端稍微靠上
          zIndex: 1100, // 高于图片和吸顶月份
          display: 'flex',
          justifyContent: 'center',
          mb: { xs: 2, md: 6 },
          pointerEvents: 'none', // 穿透，避免遮挡点击
          width: '100%', // 确保居中
        }}
      >
        <Paper
          elevation={0}
          sx={{
            py: 0.75,
            px: { xs: 1.5, md: 2.5 },
            display: 'inline-flex',
            flexDirection: 'row',
            gap: { xs: 1, md: 2 },
            alignItems: 'center',
            pointerEvents: 'auto', // 恢复自身交互
            bgcolor: alpha(theme.palette.background.paper, 0.6), // 高度通透
            backdropFilter: 'blur(32px) saturate(150%)', // 强烈的磨砂玻璃质感和色彩饱和度提升
            WebkitBackdropFilter: 'blur(32px) saturate(150%)',
            border: `1px solid ${alpha(theme.palette.text.primary, 0.04)}`, // 极弱边框，仿佛隐形
            borderRadius: '100px',
            boxShadow: `0 16px 40px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.4 : 0.08)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.1)}`, // 呼吸感极强的悬浮阴影和内部高光
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)', // 弹簧回弹感
            // 响应式微缩：在手机端尝试收缩未激活的搜索框，仅保留图标（由 TextField 内部支持）
          }}
        >
          {/* 搜索框 (融入背景) */}
          <TextField
            size="small"
            placeholder="搜索..."
            value={localSearch || ''}
            onChange={(e) => setLocalSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              sx: {
                borderRadius: '100px',
                bgcolor: 'transparent',
                '& fieldset': { border: 'none' },
                minWidth: { xs: 40, md: 180 }, // 移动端默认收起来像个图标
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                '& input': {
                  opacity: { xs: localSearch ? 1 : 0, md: 1 }, // 手机没打字时隐藏光标
                  width: { xs: localSearch ? 100 : 0, md: 'auto' }, // 手机展开
                  padding: { xs: localSearch ? '8.5px 14px' : '8.5px 0', md: '8.5px 14px' },
                },
                '&:focus-within': {
                  bgcolor: alpha(theme.palette.text.primary, 0.04),
                  minWidth: { xs: 160, md: 240 },
                  '& input': {
                    opacity: 1,
                    width: 'auto',
                    padding: '8.5px 14px',
                  }
                }
              }
            }}
          />

          <Box sx={{ width: '1px', height: 24, bgcolor: alpha(theme.palette.text.primary, 0.1) }} />

          {/* 排序与操作 */}
          <Box display="flex" gap={0.5} alignItems="center">
            <FormControl size="small">
              <Select
                value={sortBy ?? 'date-desc'}
                onChange={(e) => setSortBy(e.target.value)}
                IconComponent={SortIcon}
                sx={{
                  borderRadius: '100px',
                  bgcolor: 'transparent',
                  '& fieldset': { border: 'none' },
                  color: 'text.primary',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  '& .MuiSelect-select': { py: 0.5, pl: 1, pr: 3 },
                  '& .MuiSvgIcon-root': { right: 4, fontSize: '1.1rem', color: 'text.secondary' },
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) }
                }}
              >
                <MenuItem value="date-desc">最新</MenuItem>
                <MenuItem value="date-asc">最旧</MenuItem>
                <MenuItem value="color">颜色</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title={showFavoritesOnly ? "显示全部" : "仅显示收藏"}>
              <IconButton
                onClick={() => setShowFavoritesOnly((prev) => !prev)}
                sx={{
                  bgcolor: (showFavoritesOnly ?? false) ? alpha(theme.palette.error.main, 0.1) : 'transparent',
                  color: (showFavoritesOnly ?? false) ? theme.palette.error.main : 'text.secondary',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) }
                }}
              >
                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>❤️</span>
              </IconButton>
            </Tooltip>

            {/* 主题切换 */}
            <Tooltip title={darkMode ? '切换到亮色' : '切换到暗色'}>
              <IconButton 
                onClick={() => setDarkMode(!darkMode)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05), color: 'text.primary' }
                }}
              >
                {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* GitHub 链接 */}
            <Tooltip title="项目主页">
              <IconButton
                onClick={() => window.open('https://github.com/tonyc726/bing-wallpaper-robot', '_blank')}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05), color: 'text.primary' }
                }}
              >
                <GitHubIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      </Box>

      {/* 空状态 */}
      {sortedWallpapers.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center', bgcolor: 'transparent', border: 'none', boxShadow: 'none' }}>
          <Typography variant="h6" color="text.secondary">无匹配壁纸</Typography>
        </Paper>
      ) : (
        <Box>
          {isTimelineMode ? (
            /* ================= TIMELINE 模式 ================= */
            /* 拥有完整骨架，依靠 IntersectionObserver 按需加载 */
            data.map((group) => (
              <MonthSection
                key={`group-${group.groupMonth}`}
                group={group}
                loading={loadingMonths.has(group.groupMonth)}
                loadMonthData={loadMonthData}
                onImageClick={onImageClick}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
              />
            ))
          ) : (
            /* ================= 过滤/排序模式 ================= */
            /* 回退虚拟分页滚动，隐藏骨架，只显示已加载并匹配的项 */
            <Box>
              {groupedData.map((group) => (
                <MonthSection
                  key={`filter-group-${group.monthStr}`}
                  group={{ groupMonth: group.monthStr, wallpapers: group.items, totalCount: group.items.length }}
                  loading={false}
                  loadMonthData={() => {}}
                  onImageClick={onImageClick}
                  favorites={favorites}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}

              {/* 无限滚动触发器 */}
              {visibleCount < sortedWallpapers.length && (
                <Box ref={loadingRef} sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="caption" color="text.disabled">
                    展开更多匹配项 ({visibleCount}/{sortedWallpapers.length})...
                  </Typography>
                </Box>
              )}

              {/* 触底提示 */}
              {visibleCount >= sortedWallpapers.length && (
                <Box sx={{ mt: 8, mb: 16, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', letterSpacing: '0.1em' }}>
                    — 已展示所有匹配项 —
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default WallpaperGrid;
