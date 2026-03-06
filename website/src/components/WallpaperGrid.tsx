import React, { useState, useRef, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { useQueryState, parseAsString } from 'nuqs';
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
  useMediaQuery,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import GitHubIcon from '@mui/icons-material/GitHub';
import ClearIcon from '@mui/icons-material/Clear';
import WallpaperCard from './WallpaperCard';
import TimelineScrubber from './TimelineScrubber';
import ColorScrubber from './ColorScrubber';
import { getHexColorCategory, COLOR_ORDER } from '../utils/colorUtils';
import type { WallpaperData, WallpapersGroupData, IndexData } from '../types';

interface Props {
  data: WallpapersGroupData[];
  onImageClick: (wallpaper: WallpaperData, contextWallpapers: WallpaperData[]) => void;
  indexData: IndexData | null;
  loadingMonths: Set<string>;
  loadMonthData: (month: string) => Promise<void>;
  loadAllData: () => Promise<Map<string, WallpaperData[]> | undefined>;
  isLoadingAllData?: boolean;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

const ITEMS_PER_PAGE = 24;
const ITEMS_PER_PAGE_NON_TIMELINE = 12; // 非 timeline 模式下使用较少的初始加载

interface MonthSectionProps {
  group: WallpapersGroupData;
  loading: boolean;
  loadMonthData: (month: string) => void;
  onImageClick: (wallpaper: WallpaperData, contextWallpapers: WallpaperData[]) => void;
  contextWallpapers: WallpaperData[]; // 传入当前过滤后的上下文合集
  sortBy?: string | null;
  disableUrlSync?: boolean; // 新增：是否禁用视口滚动时的URL同步
  forceRender?: boolean; // 新增：即使没有进入视口，也强制渲染真实数据（用于搜索过滤结果）
}

const MonthSection: React.FC<MonthSectionProps> = React.memo(
  ({ group, loading, loadMonthData, onImageClick, contextWallpapers, disableUrlSync, forceRender }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const theme = useTheme();
    
    // 视口水闸锁定状态：只有进入过视口附近，才允许将海量数据渲染为真实 DOM
    const [hasIntersected, setHasIntersected] = useState(false);

    // 用于浅路由状态同步
    const [, setQueryMonth] = useQueryState('month', {
      shallow: true,
      history: 'replace', // 滚动时不产生大量的历史记录堆栈
    });

    useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    // === 合并为单一 Observer，分别处理「数据加载」和「URL 同步」两个职责 ===
    // 节省了 58 个 IntersectionObserver 实例
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // 职责 A: 惰性加载月份数据 (在视口接近 400px 时) / 解开视口渲染水闸
          if (!hasIntersected) {
            setHasIntersected(true);
          }
          if (group.wallpapers.length === 0 && !loading) {
            loadMonthData(group.groupMonth);
          }
          
          // 职责 B: URL 同步 (仅当元素有较大比例进入核心视口)
          // 通过判断 intersectionRatio 加上我们设定的 threshold，如果被禁用了（例如正在打字搜索期）则绝对不要回推URL
          if (entry.intersectionRatio > 0.3 && !disableUrlSync) {
            setQueryMonth(group.groupMonth);
          }
        }
      },
      { rootMargin: '400px 0px -40% 0px', threshold: [0, 0.4] }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  }, [group.groupMonth, group.wallpapers.length, loading, loadMonthData, setQueryMonth, disableUrlSync, hasIntersected]);

    // ==== 如果没有数据，或者被视口水闸锁死了，渲染骨架屏 ====
    // 即便后台因为搜索动作把 1839 条数据塞进了本月份的 group.wallpapers 里，
    // 只要这段区域目前不在屏幕可见范围，那就强行剥夺它渲染这几百个 3D 卡片的资格，维持骨架屏！
    const isSkeleton = group.wallpapers.length === 0 || (!hasIntersected && !forceRender);
    const renderCount = (group.wallpapers.length === 0) ? (group.totalCount || 0) : group.wallpapers.length;

    if (renderCount === 0) return null;

    // 优雅的格式化
    let watermarkText = group.groupMonth;

    const dateMatch = group.groupMonth.match(/^(\d{4})-(\d{2})$/);
    if (dateMatch) {
      const year = dateMatch[1];
      const monthIdx = parseInt(dateMatch[2], 10) - 1;
      const enMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      watermarkText = `${enMonths[monthIdx]} ${year}`;
    } else if (group.groupMonth.includes('年') && group.groupMonth.includes('月')) {
      // 防止过滤/排序组合产生了类似 2026年02月 的旧数据缓存
      watermarkText = group.groupMonth.replace('年', '').replace('月', ''); // 去除年月，变成 2026 02
    }

    // 为电影感排版解析数据
    let cinematicYear = '';
    let cinematicMonthEn = '';
    let cinematicMonthCn = '';

    const dateMatchCinema = group.groupMonth.match(/^(\d{4})-(\d{2})$/);
    if (dateMatchCinema) {
      cinematicYear = dateMatchCinema[1];
      const mIdx = parseInt(dateMatchCinema[2], 10) - 1;
      const enMonths = [
        'JANUARY',
        'FEBRUARY',
        'MARCH',
        'APRIL',
        'MAY',
        'JUNE',
        'JULY',
        'AUGUST',
        'SEPTEMBER',
        'OCTOBER',
        'NOVEMBER',
        'DECEMBER',
      ];
      const cnMonths = [
        '一月',
        '二月',
        '三月',
        '四月',
        '五月',
        '六月',
        '七月',
        '八月',
        '九月',
        '十月',
        '十一月',
        '十二月',
      ];
      cinematicMonthEn = enMonths[mIdx];
      cinematicMonthCn = cnMonths[mIdx];
    } else {
      // 兼容回退
      cinematicMonthEn = watermarkText;
      cinematicMonthCn = '';
    }

    return (
      <Box ref={containerRef} sx={{ mb: { xs: 8, md: 15 }, position: 'relative' }}>
        {/* 方案 C (Kinetic Typography 动效排版) - 出血级幽灵水印伴随滚动视差 */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.1, margin: '200px' }} // 滚动视差进入
          transition={{ duration: 1.2, ease: [0.165, 0.84, 0.44, 1] }}
          sx={{
            position: 'absolute',
            top: { xs: -40, md: -120 }, // 更激进的错位，拉开空间层次
            left: { xs: -20, md: -60 }, // 出血设计 (Bleed) - 故意超出屏幕边缘截断部分字母，极具张力
            zIndex: 0, // 沉在图片底部
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <Typography
            variant="h1" // 使用巨大的 h1
            id={`month-${group.groupMonth.replace(/年|月/g, '').replace(/\./g, '-')}`}
            sx={{
              fontWeight: 900,
              color: 'transparent',
              WebkitTextStroke: `1px ${alpha(theme.palette.text.primary, 0.12)}`, // 极淡的描边
              letterSpacing: '-0.05em', // 极致收紧
              whiteSpace: 'nowrap',
              textTransform: 'uppercase',
              fontSize: { xs: '6rem', sm: '10rem', md: '18rem', lg: '24rem' }, // 视觉核弹级的字号
              lineHeight: 0.8,
              fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
            }}
          >
            {watermarkText}
          </Typography>
        </Box>

        {/* 方案 B (Cinematic 电影感) - 吸顶导航的微排版结构 */}
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 100, // 高于图片
            py: { xs: 2, md: 3 },
            // 极致的融合渐变遮罩
            background: `linear-gradient(to bottom, ${alpha(theme.palette.background.default, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.7)} 50%, ${alpha(theme.palette.background.default, 0)} 100%)`,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            pointerEvents: 'none', // 不阻挡底层图片的交互
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 2, md: 4 }, // 年份和月份间的极简留白
            px: { xs: 2.5, md: 4.5 },
          }}
        >
          {/* 左侧：横转 90 度的极小年份标识 */}
          {cinematicYear && (
            <Typography
              sx={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)', // 让字头朝左
                fontSize: { xs: '0.6rem', md: '0.75rem' },
                fontWeight: 700,
                letterSpacing: '0.2em',
                color: alpha(theme.palette.text.primary, 0.5),
                fontFamily: '"Inter", "Helvetica", sans-serif',
              }}
            >
              {cinematicYear}
            </Typography>
          )}

          {/* 右侧：超粗字距全大写月份 + 下方微细中文 */}
          <Box display="flex" flexDirection="column" justifyContent="center">
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                letterSpacing: { xs: '0.1em', md: '0.3em' }, // 电影感精髓：拉开巨宽的字间距
                color: theme.palette.text.primary,
                textTransform: 'uppercase',
                lineHeight: 1,
                fontFamily: '"Inter", "Helvetica", sans-serif',
                textShadow: `0 4px 24px ${alpha(theme.palette.background.default, 0.8)}`,
              }}
            >
              {cinematicMonthEn}
            </Typography>
            {cinematicMonthCn && (
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 400,
                  letterSpacing: '0.3em',
                  color: alpha(theme.palette.text.primary, 0.4),
                  marginTop: { xs: '4px', md: '8px' },
                  paddingLeft: '4px', // 对齐光学视觉边缘
                }}
              >
                {cinematicMonthCn}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Ultra High Density Asymmetric Grid */}
        <Grid
          container
          spacing={{ xs: 0, md: 0.5 }} // 移动端 0 缝隙，PC 4px 细缝
          sx={{ px: 0, zIndex: 1, position: 'relative' }} // 彻底去除两边 padding
        >
          {/* 骨架屏或内容映射 */}
          {isSkeleton
            ? Array.from({ length: renderCount }).map((_, i) => {
                // 骨架屏也遵循不规则排版
                const isFeatured = i % 7 === 0;
                const isTabletFeatured = i % 5 === 0;
                const spanXs = 6;
                const spanSm = isTabletFeatured ? 8 : 4;
                const spanMd = isFeatured ? 6 : 3;
                const spanLg = isFeatured ? 4 : 2;
                const spanXl = isFeatured ? 3 : 1.5;

                return (
                  <Grid
                    item
                    xs={spanXs}
                    sm={spanSm}
                    md={spanMd}
                    lg={spanLg}
                    xl={spanXl}
                    key={`skeleton-${group.groupMonth}-${i}`}
                  >
                    <Box
                      sx={{
                        paddingTop: '56.25%',
                        position: 'relative',
                        width: '100%',
                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          animation: loading ? 'pulse 1.5s ease-in-out infinite' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 0.5 },
                            '50%': { opacity: 0.8 },
                          },
                        }}
                      />
                    </Box>
                  </Grid>
                );
              })
            : group.wallpapers.map((wallpaper, index) => {
                const isFeatured = index % 7 === 0;
                const isTabletFeatured = index % 5 === 0;
                const spanXs = 6;
                const spanSm = isTabletFeatured ? 8 : 4;
                const spanMd = isFeatured ? 6 : 3;
                const spanLg = isFeatured ? 4 : 2;
                const spanXl = isFeatured ? 3 : 1.5;

                return (
                  <Grid item xs={spanXs} sm={spanSm} md={spanMd} lg={spanLg} xl={spanXl} key={wallpaper.id}>
                    <Box
                      sx={{
                        height: '100%',
                        opacity: 0,
                        animation: 'cardReveal 0.8s cubic-bezier(0.165, 0.84, 0.44, 1) forwards',
                        animationDelay: `${(index % 12) * 0.05}s`,
                        '@keyframes cardReveal': {
                          '0%': { opacity: 0, transform: 'translateY(40px) scale(0.95)' },
                          '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
                        },
                      }}
                    >
                      <WallpaperCard
                        wallpaper={wallpaper}
                        onImageClick={(w) => onImageClick(w, contextWallpapers)}
                      />
                    </Box>
                  </Grid>
                );
              })}
        </Grid>
      </Box>
    );
  },
  (prevProps: MonthSectionProps, nextProps: MonthSectionProps) => {
    if (prevProps.group.groupMonth !== nextProps.group.groupMonth) return false;
    if (prevProps.group.wallpapers.length !== nextProps.group.wallpapers.length) return false;
    if (prevProps.loading !== nextProps.loading) return false;
    if (prevProps.sortBy !== nextProps.sortBy) return false;
    return true;
  },
);

// eslint-disable-next-line complexity
const WallpaperGrid: React.FC<Props> = ({
  data,
  onImageClick,
  loadingMonths,
  loadMonthData,
  loadAllData,
  isLoadingAllData = false,
  darkMode,
  setDarkMode,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // === URL 状态管理 ===
  // 核心修复 A：移除危险的 startTransition，在输入框强交互处避免引发并发调度的时空裂痕
  const [searchTerm, setSearchTerm] = useQueryState('q', parseAsString);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [sortBy, setSortBy] = useQueryState('sort', parseAsString.withDefault('date-desc'));

  const [localSearch, setLocalSearch] = useState(searchTerm || '');
  const isComposingRef = useRef(false);
  // 【新增防线】专门用来抵御未完成打字过程中的 URL 强制倒灌
  const isTypingRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      // 1. 如果处于中文等输入法组合状态（如拼音未完成），则暂不触发真实搜索
      if (isComposingRef.current) return;

      // 2. 规范化用户的输入：去前后空格，将连续多个特殊空白字符合并为单空格
      const cleanTerm = localSearch.replace(/\s+/g, ' ').trim();
      const val = cleanTerm || null;
      if (searchTerm !== val) {
        setSearchTerm(val);
      }
      // 防抖彻底走完，证明用户已经完全停止打字动作了，可以释放“防御锁”
      isTypingRef.current = false;
    }, 400); // 400ms 毫秒防抖
    return () => clearTimeout(timer);
  }, [localSearch, searchTerm, setSearchTerm]);

  useEffect(() => {
    // 【核心修复 B】只要是在纯打字期、或者是拼音拼一半的时候，绝对不可以动用外部旧的 searchTerm 覆写输入框
    if (isTypingRef.current || isComposingRef.current) return;

    const normSearchTerm = searchTerm || '';
    if (normSearchTerm !== localSearch) {
      setLocalSearch(normSearchTerm);
    }
  }, [searchTerm, localSearch]);

  const handleComposition = (e: React.CompositionEvent<HTMLInputElement>) => {
    if (e.type === 'compositionstart') {
      isComposingRef.current = true;
    } else if (e.type === 'compositionend') {
      isComposingRef.current = false;
      // 当拼音输入结束时，仅释放组合判定
    }
  };
  const [selectedYear] = useQueryState('year', parseAsString.withDefault('all'));

  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const loadingRef = useRef<HTMLDivElement>(null);

  // === 第一步：全量数据提取与去重 + 搜索串预计算 ===
  const allWallpapers = useMemo(() => {
    const t0 = performance.now();
    const flat = data.flatMap((group) => group.wallpapers);
    const uniqueMap = new Map<string, WallpaperData>();
    flat.forEach((w) => {
      if (!uniqueMap.has(w.id)) {
        // Fix B: 空间换时间，将巨重的字符串拼接及全小写操作提前在此（且仅一次）执行
        // 并直接作为隐式属性挂载
        const clone: WallpaperData & { _searchStr?: string } = { ...w };
        clone._searchStr = `${clone.title || ''} ${clone.copyright || ''} ${clone.id || ''}`.toLowerCase();
        uniqueMap.set(w.id, clone);
      }
    });
    const result = Array.from(uniqueMap.values());
    const t1 = performance.now();
    console.log(`[Perf] 🔍 allWallpapers (parse & string cache): ${(t1 - t0).toFixed(2)}ms, items: ${result.length}`);
    return result;
  }, [data]);

  // === 第二步：过滤 ===
  const filteredWallpapers = useMemo(() => {
    const t0 = performance.now();
    let result = allWallpapers;

    // 搜索过滤
    if (searchTerm) {
      // 允许多个关键词（空格分隔）的“且”关系搜索，大大提升精准度
      const terms = searchTerm.toLowerCase().split(' ').filter(Boolean);

      result = result.filter((w) => {
        // O(1) 取出预先拼接小写化的全信息文本
        const searchableText = (w as any)._searchStr || `${w.title || ''} ${w.copyright || ''} ${w.id || ''}`.toLowerCase();

        // 只有当所有的搜索词段都在这张壁纸的相关信息中找到时，才算匹配成功（AND 关系）
        return terms.every((term) => searchableText.includes(term));
      });
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

    const t1 = performance.now();
    console.log(`[Perf] 🔍 filteredWallpapers (search/filter): ${(t1 - t0).toFixed(2)}ms, matched: ${result.length}/${allWallpapers.length}`);
    return result;
  }, [allWallpapers, selectedYear, searchTerm]);

  // === 使用 useDeferredValue 延迟处理大量数据变化 ===
  // 当 search 等过滤条件变化时，优先保证 UI 响应
  const deferredFilteredWallpapers = useDeferredValue(filteredWallpapers);

  // === 第三步：排序（基于延迟值） ===
  const sortedWallpapers = useMemo(() => {
    const t0 = performance.now();
    const result = [...deferredFilteredWallpapers];
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
    const t1 = performance.now();
    console.log(`[Perf] 🔍 sortedWallpapers (sort): ${(t1 - t0).toFixed(2)}ms, items: ${result.length}`);
    return result;
  }, [deferredFilteredWallpapers, sortBy]);

  // === 第四步：截取当前可见数量 (Client Pagination) ===
  const visibleWallpapers = sortedWallpapers.slice(0, visibleCount);

  // 判断是否处于纯净的时间线模式（无过滤，支持正序或倒序）
  // 新增：只要本地搜索框有内容（即便还在防抖阶段），立刻退出时间轴模式，直接踢入拥有 24 个数量限制的虚拟分页过滤模式
  // 这避免了 1839 个重型 CSS 3D 卡片组件在后台数据拉取瞬间被全部实例化塞入 DOM 引发长达数秒的死机海啸
  const isTimelineMode =
    !localSearch && !searchTerm &&
    (sortBy === 'date-desc' || sortBy === 'date-asc') &&
    selectedYear === 'all';

  // === 后台全局拉取 ===
  useEffect(() => {
    if (!isTimelineMode) {
      loadAllData();
    }
  }, [isTimelineMode, loadAllData]);

  // 新增：就算 searchTerm 正在防抖拦截，一旦输入了也提前触发加载
  useEffect(() => {
    if (localSearch) {
      loadAllData();
    }
  }, [localSearch, loadAllData]);

  // === 第五步：按特征分组 (Group by Month or Color for Headers) ===
  const groupedData = useMemo(() => {
    const t0 = performance.now();
    let finalGroups: { monthStr: string; items: WallpaperData[] }[] = [];

    if (sortBy === 'color') {
      // 按颜色归类
      const colorMap = new Map<string, WallpaperData[]>();
      COLOR_ORDER.forEach((c) => colorMap.set(c, []));

      visibleWallpapers.forEach((w) => {
        const cat = getHexColorCategory(w.dominantColor);
        if (colorMap.has(cat)) {
          colorMap.get(cat)!.push(w);
        } else {
          colorMap.set(cat, [w]);
        }
      });

      COLOR_ORDER.forEach((c) => {
        const items = colorMap.get(c);
        if (items && items.length > 0) {
          finalGroups.push({ monthStr: c, items });
        }
      });
    } else {
      // 原有逻辑：按年月或其他模式聚合
      let currentGroupMonth = '';
      let currentItems: WallpaperData[] = [];

      const isDateSort = (sortBy ?? 'date-desc').startsWith('date');

      visibleWallpapers.forEach((w) => {
        const year = Math.floor(w.date / 10000);
        const month = Math.floor((w.date % 10000) / 100);
        const mm = month < 10 ? `0${month}` : `${month}`;
        const monthStr = isDateSort ? `${year}年${mm}月` : '已排序壁纸';

        if (monthStr !== currentGroupMonth) {
          if (currentItems.length > 0) {
            finalGroups.push({ monthStr: currentGroupMonth, items: currentItems });
          }
          currentGroupMonth = monthStr;
          currentItems = [w];
        } else {
          currentItems.push(w);
        }
      });

      if (currentItems.length > 0) {
        finalGroups.push({ monthStr: currentGroupMonth, items: currentItems });
      }
    }
    
    const t1 = performance.now();
    console.log(`[Perf] 🔍 groupedData (grouping ${visibleWallpapers.length} visible items): ${(t1 - t0).toFixed(2)}ms`);
    return finalGroups;
  }, [visibleWallpapers, sortBy]);

  // 用于时间线模式的正倒序映射数据
  const timelineData = useMemo(() => {
    if (!isTimelineMode) return [];
    if (sortBy === 'date-asc') {
      return [...data].reverse().map((group) => ({
        ...group,
        wallpapers: [...group.wallpapers].reverse(),
      }));
    }
    return data;
  }, [data, isTimelineMode, sortBy]);

  // === 状态重置 ===
  useEffect(() => {
    const isTimeline =
      !localSearch && !searchTerm &&
      (sortBy === 'date-desc' || sortBy === 'date-asc') &&
      selectedYear === 'all';
    setVisibleCount(isTimeline ? ITEMS_PER_PAGE : ITEMS_PER_PAGE_NON_TIMELINE);
  }, [localSearch, searchTerm, sortBy, selectedYear]);

  // === 无限滚动侦听 ===
  useEffect(() => {
    const el = loadingRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // 非 timeline 模式使用更小的增量，避免一次加载太多
          const isTimeline =
            !searchTerm &&
            (sortBy === 'date-desc' || sortBy === 'date-asc') &&
            selectedYear === 'all';
          const increment = isTimeline ? ITEMS_PER_PAGE : ITEMS_PER_PAGE_NON_TIMELINE;
          setVisibleCount((prev: number) => Math.min(prev + increment, sortedWallpapers.length));
        }
      },
      {
        threshold: 0.1,
        rootMargin: '600px', // 提前更多触发，避免卡顿感
      },
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [sortedWallpapers.length]);

  // ==========================================
  // Dynamic Capsule V2 (灵动胶囊) 核心逻辑
  // ==========================================
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 1. 快捷键劫持 (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd + K or Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchExpanded(true);
        searchInputRef.current?.focus();
      }
      // ESC 退出版态
      if (e.key === 'Escape' && isSearchExpanded) {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSearchExpanded]);

  // 2. 智能滚动隐藏 (Smart Scroll Hide)
  const { scrollY } = useScroll();
  const [isCapsuleVisible, setIsCapsuleVisible] = useState(true);
  const lastScrollY = useRef(0);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const isScrollingDown = latest > lastScrollY.current;

    // 如果正在输入搜索，不隐藏
    if (isSearchExpanded || localSearch) {
      setIsCapsuleVisible(true);
    }
    // 往下滚超过 200px 且没有聚焦，则收起胶囊
    else if (isScrollingDown && latest > 200) {
      setIsCapsuleVisible(false);
    }
    // 往上滚，立刻唤出胶囊
    else if (!isScrollingDown) {
      setIsCapsuleVisible(true);
    }

    lastScrollY.current = latest;
  });

  // 性能优化：给 TimelineScrubber 稳定固定的数据与函数引用
  const scrubberMonths = useMemo(
    () => (isTimelineMode ? timelineData.map((g) => g.groupMonth) : []),
    [isTimelineMode, timelineData]
  );
  
  const handleScrubRequest = useCallback((month: string) => {
    const id = `month-${month.replace('年', '-').replace('月', '')}`;
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 64; // header padding offset
      window.scrollTo({ top: y, behavior: 'instant' });
    }
  }, []);

  return (
    <Box>
      {/* 沉浸式灵动胶囊过滤栏 (Dynamic Capsule V2) */}
      <Box
        component={motion.div}
        initial={{ y: -100, opacity: 0 }}
        animate={{
          y: isCapsuleVisible ? 0 : isMobile ? -10 : -20,
          scale: isCapsuleVisible ? 1 : 0.75,
          opacity: isCapsuleVisible ? 1 : 0.25,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        sx={{
          position: 'sticky',
          top: { xs: 16, md: 24 },
          zIndex: 1100,
          display: 'flex',
          justifyContent: 'center',
          mb: { xs: 2, md: 6 },
          pointerEvents: 'none',
          width: '100%',
          px: { xs: 2, md: 0 },
        }}
      >
        <Paper
          component={motion.div}
          layout // 开启流体布局动画
          elevation={0}
          onHoverStart={() => !isCapsuleVisible && setIsCapsuleVisible(true)}
          onClickCapture={(e) => {
            if (!isCapsuleVisible) {
              e.preventDefault();
              e.stopPropagation();
              setIsCapsuleVisible(true);
            }
          }}
          sx={{
            position: 'relative', // 必须 relative，供内部绝对定位的 overlay 使用
            cursor: isCapsuleVisible ? 'default' : 'pointer',
            py: { xs: isSearchExpanded ? 1.5 : 0.75, md: 1 },
            px: { xs: 1.5, md: 2.5 },
            display: 'inline-flex',
            flexDirection: { xs: isSearchExpanded ? 'column' : 'row', md: 'row' },
            gap: { xs: isSearchExpanded ? 2 : 1, md: 2 },
            alignItems: 'center',
            pointerEvents: 'auto',
            background:
              theme.palette.mode === 'dark'
                ? 'linear-gradient(145deg, rgba(30,30,30,0.8) 0%, rgba(20,20,20,0.9) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(240,240,240,0.95) 100%)',
            backdropFilter: 'blur(40px) saturate(250%)',
            WebkitBackdropFilter: 'blur(40px) saturate(250%)',
            border: `1px solid ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.05)}`,
            borderTop: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.2 : 0.5)}`, // Glowing edge
            borderRadius: { xs: isSearchExpanded ? '24px' : '100px', md: '100px' },
            boxShadow:
              theme.palette.mode === 'dark'
                ? `0 20px 40px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.1)`
                : `0 20px 40px -10px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)`,
            width: isMobile && (isSearchExpanded || localSearch) ? '100%' : 'auto',
            minWidth: { xs: 'auto', md: 'min-content' },
            overflow: 'hidden',
            // Noise 材质贴图
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
              opacity: theme.palette.mode === 'dark' ? 0.04 : 0.02,
              pointerEvents: 'none',
              mixBlendMode: 'overlay',
            },
          }}
        >
          {/* 睡眠态唤醒层 (Ghost Pill Wake Overlay) */}
          {!isCapsuleVisible && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 10,
                cursor: 'pointer',
              }}
            />
          )}

          {/* 搜索框区 */}
          <Box sx={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <TextField
              inputRef={searchInputRef}
              size="small"
              placeholder="探索馆藏…"
              value={localSearch || ''}
              onChange={(e) => {
                isTypingRef.current = true; // 用户确实在这里敲击了
                setLocalSearch(e.target.value);
              }}
              onCompositionStart={handleComposition}
              onCompositionUpdate={handleComposition}
              onCompositionEnd={handleComposition}
              onFocus={() => setIsSearchExpanded(true)}
              onBlur={() => setIsSearchExpanded(false)}
              onClick={() => setIsSearchExpanded(true)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start" sx={{ mr: { xs: 0.5, md: 1 } }}>
                    <SearchIcon
                      fontSize="small"
                      sx={{
                        color: isSearchExpanded || localSearch ? 'text.primary' : 'text.secondary',
                        transition: 'color 0.3s',
                      }}
                    />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end" sx={{ display: 'flex', gap: 0.5 }}>
                    <AnimatePresence>
                      {localSearch && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                        >
                          <IconButton
                            size="small"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setLocalSearch('');
                              setSearchTerm(null);
                            }}
                            sx={{ p: 0.25, color: 'text.secondary' }}
                          >
                            <ClearIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {/* PC 端 Command K 铭文提示 */}
                    {!isMobile && !localSearch && !isSearchExpanded && (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          border: `1px solid ${alpha(theme.palette.text.primary, 0.2)}`,
                          borderRadius: 1,
                          px: 0.5,
                          py: 0.1,
                          bgcolor: alpha(theme.palette.text.primary, 0.05),
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ fontSize: '0.65rem', color: 'text.secondary', fontWeight: 'bold' }}
                        >
                          {navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘K' : 'Ctrl+K'}
                        </Typography>
                      </Box>
                    )}
                  </InputAdornment>
                ),
                sx: {
                  borderRadius: '100px',
                  bgcolor: isMobile && isSearchExpanded ? alpha(theme.palette.text.primary, 0.05) : 'transparent',
                  '& fieldset': { border: 'none' },
                  transition: 'all 0.3s ease',
                  width: '100%',
                  '& input': {
                    width: isMobile && !(isSearchExpanded || localSearch) ? 0 : { xs: '100%', md: 180 },
                    minWidth: isMobile && !(isSearchExpanded || localSearch) ? 0 : { xs: 100, md: 'auto' },
                    opacity: isMobile && !(isSearchExpanded || localSearch) ? 0 : 1,
                    padding: isMobile && !(isSearchExpanded || localSearch) ? '8.5px 0' : '8.5px 8px',
                    transition: 'all 0.3s ease',
                    fontSize: '0.95rem',
                  },
                  '&:focus-within': {
                    bgcolor: isMobile
                      ? alpha(theme.palette.text.primary, 0.08)
                      : alpha(theme.palette.text.primary, 0.05),
                    '& input': {
                      width: { xs: '100%', md: 240 },
                    },
                  },
                },
              }}
              sx={{ flex: 1 }}
            />
          </Box>

          {/* 右侧操作区 - 支持响应式折叠与流体布局 */}
          <Box
            component={motion.div}
            layout
            sx={{
              display: 'flex',
              gap: { xs: 0.5, md: 1 },
              alignItems: 'center',
              width: isMobile && isSearchExpanded ? '100%' : 'auto',
              justifyContent: isMobile && isSearchExpanded ? 'space-around' : 'flex-start',
              borderTop: isMobile && isSearchExpanded ? `1px solid ${alpha(theme.palette.text.primary, 0.1)}` : 'none',
              pt: isMobile && isSearchExpanded ? 1.5 : 0,
            }}
          >
            {/* 分割线：仅在横向并排时显示 */}
            {!(isMobile && isSearchExpanded) && (
              <Box sx={{ width: '1px', height: 24, bgcolor: alpha(theme.palette.text.primary, 0.1), mx: 0.5 }} />
            )}

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
                  '& .MuiSelect-select': {
                    py: 0.5,
                    pl: { xs: 1, md: 1 },
                    pr: { xs: 3, md: 3 },
                    fontSize: '0.9rem', // 恢复文字显示，配合展开态
                    minHeight: 'auto',
                  },
                  '& .MuiSvgIcon-root': {
                    right: 4,
                    fontSize: '1.2rem',
                    color: 'text.secondary',
                    pointerEvents: 'none',
                  },
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05) },
                }}
              >
                <MenuItem value="date-desc">最新</MenuItem>
                <MenuItem value="date-asc">最旧</MenuItem>
                <MenuItem value="color">颜色</MenuItem>
              </Select>
            </FormControl>

            {/* 主题与 Github：移动端空间紧张，可以依旧保留，但利用前方的 flex 折叠 */}
            <Tooltip title={darkMode ? '切换到亮色' : '切换到暗色'}>
              <IconButton
                onClick={() => setDarkMode(!darkMode)}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05), color: 'text.primary' },
                }}
              >
                {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="项目主页">
              <IconButton
                onClick={() => window.open('https://github.com/tonyc726/bing-wallpaper-robot', '_blank')}
                sx={{
                  color: 'text.secondary',
                  '&:hover': { bgcolor: alpha(theme.palette.text.primary, 0.05), color: 'text.primary' },
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
          {isLoadingAllData ? (
            // 全量数据加载中：显示加载提示，而非虚假的“无结果”
            <>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  mx: 'auto',
                  mb: 2,
                  borderRadius: '50%',
                  border: `3px solid ${alpha(theme.palette.text.primary, 0.1)}`,
                  borderTopColor: theme.palette.text.secondary,
                  animation: 'spin 0.8s linear infinite',
                  '@keyframes spin': { to: { transform: 'rotate(360deg)' } },
                }}
              />
              <Typography variant="body2" color="text.secondary">
                正在检索全部馆藏…
              </Typography>
            </>
          ) : (
            <Typography variant="h6" color="text.secondary">
              未找到匹配的馆藏
            </Typography>
          )}
        </Paper>
      ) : (
        <Box>
          {isTimelineMode ? (
            /* ================= TIMELINE 模式 ================= */
            /* 拥有完整骨架，依靠 IntersectionObserver 按需加载 */
            timelineData.map((group) => (
              <MonthSection
                key={group.groupMonth}
                group={group}
                loading={loadingMonths.has(group.groupMonth)}
                loadMonthData={loadMonthData}
                onImageClick={onImageClick}
                contextWallpapers={sortedWallpapers}
                sortBy={sortBy}
                disableUrlSync={!!localSearch || !!searchTerm} // 正在搜素/打字途中，绝对不要动 URL！
              />
            ))
          ) : (
            /* ================= 过滤/排序模式 ================= */
            /* 回退虚拟分页滚动，隐藏骨架，只显示已加载并匹配的项 */
            <Box>
              {groupedData.map((group) => (
                <MonthSection
                  key={group.monthStr}
                  group={{ groupMonth: group.monthStr, wallpapers: group.items, totalCount: group.items.length }}
                  loading={false}
                  loadMonthData={() => {}}
                  onImageClick={onImageClick}
                  contextWallpapers={sortedWallpapers}
                  disableUrlSync={true} // 过滤模式下也不再通过月份覆盖 URL
                  forceRender={true} // 过滤模式数据极少（<=24），为了防止闪烁，无论视口在哪直接强制渲染
                />
              ))}

              {/* 无限滚动触发器 */}
              {visibleCount < sortedWallpapers.length && (
                <Box
                  ref={loadingRef}
                  sx={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
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

      {/* 沉浸式侧边时光轴 (仅纯净日期模式显示) */}
      {isTimelineMode && (
        <TimelineScrubber
          months={scrubberMonths}
          onScrubRequest={handleScrubRequest}
        />
      )}

      {/* 沉浸式侧边颜色轴 (仅在颜色排序模式下显示) */}
      {sortBy === 'color' && (
        <ColorScrubber
          colors={groupedData.map((g) => g.monthStr as any)}
          onScrubRequest={(color: string) => {
            const id = `month-${color.replace('年', '-').replace('月', '')}`; // 复用 MonthSection 生成的 ID
            const el = document.getElementById(id);
            if (el) {
              const y = el.getBoundingClientRect().top + window.scrollY - 64; // header padding offset
              window.scrollTo({ top: y, behavior: 'instant' });
            }
          }}
        />
      )}
    </Box>
  );
};

export default WallpaperGrid;
