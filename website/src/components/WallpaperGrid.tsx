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
  activeSharedId: string | null;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
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
  activeSharedId: string | null;
}> = React.memo(({ group, loading, loadMonthData, onImageClick, favorites, onToggleFavorite, activeSharedId }) => {
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
    <Box ref={containerRef} sx={{ mb: 2 }}>
      {/* 月份悬浮表头 Sticky Header */}
      <Typography
        variant="h6"
        id={`month-${group.groupMonth.replace('年', '-').replace('月', '')}`}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          py: 2,
          px: { xs: 1, sm: 2, md: 4 },
          fontWeight: 600,
          color: 'text.primary',
          background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.8)} 60%, ${alpha(theme.palette.background.default, 0)} 100%)`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          letterSpacing: '0.02em',
        }}
      >
        {group.groupMonth}
      </Typography>

      {/* Ultra High Density Grid (4px Gutter, Edge-to-Edge aware) */}
      <Grid
        container
        spacing={0.5} // MUI spacing 0.5 = 4px 极窄间距
        sx={{ px: { xs: 0, sm: 0.5, md: 1 } }}
      >
        {isSkeleton ? (
          Array.from({ length: renderCount }).map((_, i) => (
            <Grid 
              item 
              xs={6} sm={4} md={3} lg={2} xl={1.5} 
              key={`skeleton-${group.groupMonth}-${i}`}
            >
              <Box sx={{ paddingTop: '56.25%', position: 'relative', width: '100%', bgcolor: alpha(theme.palette.text.primary, 0.04), borderRadius: 1, overflow: 'hidden' }}>
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
          group.wallpapers.map((wallpaper) => (
            <Grid 
              item 
              xs={6} sm={4} md={3} lg={2} xl={1.5} 
              key={wallpaper.id}
            >
              <WallpaperCard
                wallpaper={wallpaper}
                onImageClick={onImageClick}
                isFavorite={favorites.has(wallpaper.id)}
                onToggleFavorite={onToggleFavorite}
                activeSharedId={activeSharedId}
              />
            </Grid>
          ))
        )}
      </Grid>
    </Box>
  );
});

const WallpaperGrid: React.FC<Props> = ({
  data,
  onImageClick,
  favorites,
  onToggleFavorite,
  loadingMonths,
  loadMonthData,
  activeSharedId,
  darkMode,
  setDarkMode,
}) => {
  const theme = useTheme();

  // === URL 状态管理 ===
  const [searchTerm, setSearchTerm] = useQueryState('q', {
    throttleMs: 300,
  });
  const [sortBy, setSortBy] = useQueryState('sort', {
    defaultValue: 'date-desc',
  });
  // We no longer use a year toggle on the UI, but we keep the state if someone filters via URL
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
      {/* 沉浸式悬浮筛选栏 (Minimal Glassmorphism Pill) */}
      <Box
        sx={{
          position: 'sticky',
          top: 24, // 留出呼吸感
          zIndex: 1100, // 高于图片
          display: 'flex',
          justifyContent: 'center',
          mb: 4,
          pointerEvents: 'none', // 穿透
        }}
      >
        <Paper
          elevation={0}
          sx={{
            py: 1,
            px: 2,
            display: 'inline-flex',
            flexDirection: 'row',
            gap: 2,
            alignItems: 'center',
            pointerEvents: 'auto', // 恢复自身交互
            bgcolor: alpha(theme.palette.background.paper, 0.75), // 自适应毛玻璃
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
            borderRadius: '100px',
            boxShadow: `0 8px 32px ${alpha(theme.palette.text.primary, 0.15)}`,
            transition: 'all 0.3s ease',
          }}
        >
          {/* 搜索框 (融入背景) */}
          <TextField
            size="small"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                minWidth: { xs: 120, md: 180 },
                transition: 'width 0.3s',
                '&:focus-within': {
                  bgcolor: alpha(theme.palette.text.primary, 0.05),
                  minWidth: { xs: '100%', md: 240 },
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
                activeSharedId={activeSharedId}
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
                  activeSharedId={activeSharedId}
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
