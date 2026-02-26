import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LayoutGroup } from 'framer-motion';
import {
  Typography,
  Box,
  CssBaseline,
  ThemeProvider,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import WallpaperGrid from './components/WallpaperGrid';
import ImageDialog from './components/ImageDialog';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import TimelineScrubber from './components/TimelineScrubber';
import type { IndexData, WallpaperData } from './types';
import { initDataLoader, fetchIndexData, fetchChunksBatch, getCacheStatus } from './dataLoader';
import { swRegister } from './utils/swRegister';
import { lightTheme, darkTheme } from './theme';
import { AnimatePresence } from 'framer-motion';

function App() {
  // ========== 状态管理 ==========
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [wallpaperData, setWallpaperData] = useState<Map<string, WallpaperData[]>>(new Map());
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const isInitializedRef = useRef(false);

  // 主题
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const currentTheme = darkMode ? darkTheme : lightTheme;

  const handleThemeToggle = useCallback((newVal?: boolean) => {
    setDarkMode((prev: boolean) => {
      const target = newVal !== undefined ? newVal : !prev;
      localStorage.setItem('darkMode', JSON.stringify(target));
      return target;
    });
  }, []);

  // 收藏
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('favorites');
    return new Set(saved ? JSON.parse(saved) : []);
  });

  // 图片查看
  const [selectedImage, setSelectedImage] = useState<WallpaperData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeSharedId, setActiveSharedId] = useState<string | null>(null);

  // 稳定的gridData引用：直接映射整份 indexData.monthList 作为 DOM 渲染框架
  const gridData = useMemo(() => {
    if (!indexData) return [];
    const data = indexData.monthList.map((month) => ({
      groupMonth: month,
      wallpapers: wallpaperData.get(month) || [],
      // 从 index 注入当前月份的预期数量，供骨架屏占位使用
      totalCount: indexData.chunks[month]?.recordCount || 0,
    }));
    const totalCount = data.reduce((sum, group) => sum + group.wallpapers.length, 0);
    console.log(
      `[App] Memoized gridData: months=${data.length}, loaded_wallpapers=${totalCount}`,
    );
    return data;
  }, [indexData, wallpaperData]);

  // 高频访问的展平数组：避免在渲染或点击下一张时实时 flatMap
  const allWallpapers = useMemo(() => {
    if (!indexData) return [];
    return indexData.monthList.flatMap((month) => wallpaperData.get(month) || []);
  }, [indexData, wallpaperData]);

  // ========== 初始化 ==========
  useEffect(() => {
    // 防止 React.StrictMode 导致重复初始化
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      initializeApp();
    }
  }, []); // 空依赖数组，只运行一次

  // ========== 本地存储同步 ==========
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  /**
   * 初始化应用
   */
  const initializeApp = async () => {
    const log = (...args: unknown[]) => console.log(`[${new Date().toISOString()}]`, ...args);

    try {
      setInitializing(true);
      log('%c🚀 ===== Bing Wallpaper System v4.0 =====', 'color: #2196F3; font-weight: bold; font-size: 16px');
      log('%c📊 System Information:', 'color: #4CAF50; font-weight: bold');
      log(`   - Platform: ${navigator.platform}`);
      log(`   - User Agent: ${navigator.userAgent.substring(0, 100)}...`);
      log(
        `   - Memory: ${performance.memory?.usedJSHeapSize ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'}`,
      );
      log(`   - Storage: Available`);
      log('');

      // 1. 初始化数据加载器（IndexedDB）
      log('%c🔌 Step 1/4: Initializing Data Loader', 'color: #FF9800; font-weight: bold');
      const dbStart = Date.now();
      await initDataLoader();
      log(`✅ Data Loader initialized in ${Date.now() - dbStart}ms`);

      // 1.5. 检查数据库状态
      log('%c💾 Step 2/4: Database Status', 'color: #FF9800; font-weight: bold');
      const cacheStatus = getCacheStatus();
      log(`   - Memory Cache: ${cacheStatus.memoryCache.size}/${cacheStatus.memoryCache.max}`);
      if (cacheStatus.lruCache) {
        log(`   - LRU Cache: ${cacheStatus.lruCache.size}/${cacheStatus.lruCache.max}`);
      }

      // 1.9. 注册 Service Worker
      log('%c📡 Step 3/4: Registering Service Worker', 'color: #FF9800; font-weight: bold');
      await swRegister.register();
      log('✅ Service Worker initialization completed');

      // 2. 获取索引数据
      log('%c📄 Step 4/4: Fetching Index Data', 'color: #FF9800; font-weight: bold');
      const indexStart = Date.now();
      const index = await fetchIndexData();
      setIndexData(index);
      log(`✅ Index loaded in ${Date.now() - indexStart}ms`);
      log(`   - Total wallpapers: ${index.totalWallpapers}`);
      log(`   - Total months: ${Object.keys(index.chunks).length}`);
      log(`   - Latest month: ${index.latestMonth}`);
      log(`   - Oldest month: ${index.oldestMonth}`);
      log(`   - Data version: ${index.dataVersion}`);
      log(`   - Generated at: ${index.generatedAt}`);

      // 2.1 首屏按需加载（仅下载最近 3 个月数据）
      log('%c📦 Loading Initial 3 Months Data (Lazy Load Strategy)', 'color: #9C27B0; font-weight: bold');
      const initialMonths = index.monthList.slice(0, 3);
      log(`   - Months: ${initialMonths.length} total`);

      // 4. 批量加载数据
      const loadStart = Date.now();
      await loadInitialData(initialMonths);
      const loadDuration = Date.now() - loadStart;

      log('');
      log('%c🎉 ===== Initialization Complete! =====', 'color: #4CAF50; font-weight: bold; font-size: 16px');
      log(`⏱️  Total initialization time: ${loadDuration}ms`);
      log(`💾 Database mode: v4.0 (hybrid flattened)`);
      log(`🚀 Ready for user interaction!`);
      log('');
    } catch (error) {
      log('');
      log('%c❌ ===== Initialization Failed! =====', 'color: #F44336; font-weight: bold; font-size: 16px');
      log(`Error: ${error instanceof Error ? error.message : error}`);
      log(`Stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      console.error('Full error details:', error);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  /**
   * 加载初始数据
   */
  const loadInitialData = async (months: string[]) => {
    setLoadingProgress(10);

    const expectedVersions = new Map<string, string>();
    for (const m of months) {
      if (indexData?.chunks[m]) {
        expectedVersions.set(m, indexData.chunks[m].version);
      }
    }

    const dataMap = await fetchChunksBatch(months, (loaded, total) => {
      setLoadingProgress(10 + (loaded / total) * 90);
    }, undefined, expectedVersions);

    setWallpaperData(dataMap);
  };

  /**
   * 被 WallpaperGrid 的 IntersectionObserver 调用的按需加载回调
   */
  const loadMonthData = useCallback(async (month: string) => {
    if (!indexData || wallpaperData.has(month) || loadingMonths.has(month)) return;

    // 标记为加载中，防止重复触发
    setLoadingMonths(prev => new Set(prev).add(month));
    
    try {
      const expectedVersions = new Map<string, string>();
      expectedVersions.set(month, indexData.chunks[month]?.version);
      
      const newMap = await fetchChunksBatch([month], undefined, undefined, expectedVersions);
      setWallpaperData(prev => {
        const next = new Map(prev);
        for (const [m, data] of newMap.entries()) {
          next.set(m, data);
        }
        return next;
      });
    } catch (e) {
      console.error(`[App] Failed to load data for month: ${month}`, e);
    } finally {
      setLoadingMonths(prev => {
        const next = new Set(prev);
        next.delete(month);
        return next;
      });
    }
  }, [indexData, wallpaperData, loadingMonths]);

  /**
   * 处理图片点击
   */
  const handleImageClick = useCallback(
    (wallpaper: WallpaperData) => {
      if (!indexData) return;

      setActiveSharedId(wallpaper.id); // Enable shared layout origin exclusively for the clicked image
      
      // 只使用已加载并展开的数据，因为 Dialog 不应呈现骨架
      const index = allWallpapers.findIndex((w) => w.id === wallpaper.id);
      setCurrentImageIndex(index >= 0 ? index : 0);
      setSelectedImage(wallpaper);
    },
    [indexData, allWallpapers, setActiveSharedId],
  );

  /**
   * 切换收藏
   */
  const handleToggleFavorite = useCallback(
    (wallpaper: WallpaperData) => {
      const newFavorites = new Set(favorites);
      if (newFavorites.has(wallpaper.id)) {
        newFavorites.delete(wallpaper.id);
      } else {
        newFavorites.add(wallpaper.id);
      }
      setFavorites(newFavorites);
    },
    [favorites],
  );


  /**
   * 键盘快捷键
   */
  useEffect(() => {
    const handleKeyDown = () => {
      // reserved for future shortcuts
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * 监听网络状态
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('[App] 网络已连接');
    };

    const handleOffline = () => {
      console.log('[App] 网络已断开');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ========== 渲染 ==========

  // 加载中
  if (initializing || loading) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: 2,
          }}
        >
          <CircularProgress size={60} />
          <Typography variant="h6" color="text.secondary">
            加载壁纸数据中...
          </Typography>
          {loadingProgress > 0 && loadingProgress < 100 && (
            <Box sx={{ width: 300 }}>
              <LinearProgress variant="determinate" value={loadingProgress} />
            </Box>
          )}
        </Box>
      </ThemeProvider>
    );
  }

  // 数据不可用
  if (!indexData) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
          }}
        >
          <Typography variant="h6" color="error">
            无法加载数据，请检查网络连接
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={currentTheme}>
      <LayoutGroup>
        <CssBaseline />

      {/* 主内容 - 真正的 Edge to Edge (消融边界) */}
      <Box sx={{ px: 0, py: 0 }}>
        <WallpaperGrid
          data={gridData}
          onImageClick={handleImageClick}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          indexData={indexData}
          loadingMonths={loadingMonths}
          loadMonthData={loadMonthData}
          activeSharedId={activeSharedId}
          darkMode={darkMode}
          setDarkMode={handleThemeToggle}
        />
      </Box>

      {/* 图片查看器 */}
      <AnimatePresence onExitComplete={() => setActiveSharedId(null)}>
        {selectedImage && (
          <ImageDialog
            wallpaper={selectedImage}
            allWallpapers={allWallpapers}
            currentIndex={currentImageIndex}
            onClose={() => {
              setActiveSharedId(selectedImage.id); // Enable fly-back to grid target map
              setSelectedImage(null);
            }}
            onPrevious={() => {
              if (currentImageIndex > 0) {
                setActiveSharedId('NONE'); // Disable grid fly-in layout origin for slides
                const newIndex = currentImageIndex - 1;
                setCurrentImageIndex(newIndex);
                setSelectedImage(allWallpapers[newIndex]);
              }
            }}
            onNext={() => {
              if (currentImageIndex < allWallpapers.length - 1) {
                setActiveSharedId('NONE'); // Disable grid fly-in layout origin for slides
                const newIndex = currentImageIndex + 1;
                setCurrentImageIndex(newIndex);
                setSelectedImage(allWallpapers[newIndex]);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* 时光轴 (Timeline Scrubber) - 无缝瞬间滚动 */}
      <TimelineScrubber 
        months={indexData.monthList} 
        onScrubRequest={(month) => {
          const id = `month-${month.replace('年', '-').replace('月', '')}`;
          const el = document.getElementById(id);
          if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 64; // header padding offset
            window.scrollTo({ top: y, behavior: 'instant' });
          }
        }} 
      />

      {/* PWA 安装提示 */}
      <PWAInstallPrompt />
      </LayoutGroup>
    </ThemeProvider>
  );
}

export default App;
