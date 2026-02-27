// v3.0+ 新架构：分块加载 + MD5版本控制

/**
 * 壁纸数据（v3.0+ 优化版）
 * 新增 dateFmt 字段用于前端日期显示
 */
export interface WallpaperData {
  // === 核心数据 ===
  id: string;                          // 壁纸ID
  date: number;                        // 日期（YYYYMMDD，数字格式）
  dateFmt: string;                     // 格式化日期（YYYY-MM-DD）

  // === 文本信息 ===
  title: string | null;                // 标题
  copyright: string | null;            // 版权信息

  // === 视觉特征 ===
  dominantColor: string;               // 主色调（hex）

  // === URL（CDN）===
  imageUrl: string;                    // 缩略图URL
  downloadUrl: string;                 // 下载URL
}

export interface WallpapersGroupData {
  groupMonth: string;
  wallpapers: WallpaperData[];
  totalCount?: number;
}

/**
 * 分块元数据
 */
export interface ChunkMetadata {
  // === 版本信息 ===
  version: string;                     // md5:abc123...
  updatedAt: string | null;            // 更新时间

  // === 数据状态 ===
  isChanged: boolean;                  // 是否发生内容变更
  recordCount: number;                 // 记录数（当月总数）

  // === 校验数据 ===
  checksum: string;                    // md5:...
  previousHash: string | null;         // 上次内容哈希

  // === 存储信息（可选）===
  fileSize?: number;                   // 文件大小
  compressionRatio?: number;           // 压缩比
  lastAccessed?: string;               // 最后访问
}

/**
 * index.json 索引文件
 */
export interface IndexData {
  // === 版本信息 ===
  version: '2.0';                      // 数据版本
  schemaVersion: 2;                    // 架构版本
  dataVersion: string;                 // 整体数据MD5
  generatedAt: string;                 // 生成时间
  lastModified: string;                // 修改时间

  // === 统计信息 ===
  totalWallpapers: number;             // 总壁纸数

  // === 分块数据 ===
  chunks: {
    [month: string]: ChunkMetadata;    // 月份 -> 元数据
  };

  // === 统计数据 ===
  stats: {
    total: number;
    changedChunks: number;
    unchangedChunks: number;
    colors: Array<{ name: string; count: number }>;
    byMonth: Array<{ month: string; count: number }>;
  };

  // === 更新日志 ===
  updateLog: Array<{
    date: string;
    action: 'add' | 'update' | 'delete';
    count: number;
    description: string;
    chunksChanged?: string[];
    impactedUsers?: number;
  }>;

  // === 索引信息 ===
  monthList: string[];
  latestMonth: string;
  oldestMonth: string;

  // === all.js 版本控制 ===
  allJsVersion?: string;               // all.js 内容 MD5，用于客户端缓存失效判断
}

/**
 * 分块数据文件 chunks/{YYYY-MM}.json
 */
export interface ChunkData {
  // === 核心信息 ===
  schemaVersion: 2;
  version: string;
  month: string;
  updatedAt: string | null;

  // === 数据内容 ===
  wallpapers: WallpaperData[];

  // === 元数据 ===
  metadata: {
    recordCount: number;
    checksum: string;
    previousHash: string | null;
    compressionRatio?: number;
    originalSize?: number;
    encodedAt?: string;
  };

  // === 统计信息 ===
  stats?: {
    dominantColors: string[];
    dateRange: {
      start: string;
      end: string;
    };
  };
}

// 兼容性：旧版本接口（标记为废弃）
export interface PreviewData {
  deprecated: true;
  version: '3.0+';
  message: string;
  redirectTo: string;
}
