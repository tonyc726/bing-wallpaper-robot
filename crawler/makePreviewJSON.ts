import 'reflect-metadata';
import 'sqlite3';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { map, get, find, filter, sortBy, isString, reduce } from 'lodash';


const writeFileAsync = util.promisify(fs.writeFile);
const readFileAsync = util.promisify(fs.readFile);
const mkdirAsync = util.promisify(fs.mkdir);

import AppDataSource from './database';
import { Imagekit } from './models';

// 新的数据类型（v3.0+ 优化版）
export interface WallpaperData {
  // === 核心数据 ===
  id: string;                          // 壁纸ID（来自filename）
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
}

// ==== v3.0+ 新增：分块数据结构 ====

/**
 * 分块元数据
 * 每个月份的数据块包含版本信息和校验数据
 */
interface ChunkMetadata {
  // === 版本信息 ===
  version: string;                     // md5:abc123...（内容哈希）
  hash: string;                        // abc123...（纯MD5）
  updatedAt: string | null;            // 更新时间（null = 未更改）

  // === 数据状态 ===
  isChanged: boolean;                  // 是否发生内容变更
  recordCount: number;                 // 记录数（当月总数）

  // === 校验数据 ===
  checksum: string;                    // md5:...（数据校验）
  previousHash: string | null;         // 上次内容哈希

  // === 存储信息（可选）===
  fileSize?: number;                   // 文件大小（字节）
  compressionRatio?: number;           // 压缩比（0-1）
  lastAccessed?: string;               // 最后访问时间
}

/**
 * index.json 索引文件
 * 文件大小: ~5KB
 * 作用: 索引所有月份数据
 */
interface IndexData {
  // === 版本信息 ===
  version: '2.0';                      // 数据版本
  schemaVersion: 2;                    // 架构版本
  dataVersion: string;                 // 整体数据MD5哈希（ETag）
  generatedAt: string;                 // 生成时间 ISO 8601
  lastModified: string;                // 最后修改时间

  // === 统计信息 ===
  totalWallpapers: number;             // 总壁纸数

  // === 分块数据（核心） ===
  chunks: {
    [month: string]: ChunkMetadata;    // 月份 -> 元数据
  };

  // === 统计数据 ===
  stats: {
    total: number;                     // 总记录数
    changedChunks: number;             // 发生变更的分块数
    unchangedChunks: number;           // 未变更的分块数

    // 颜色统计（Top 10）
    colors: Array<{
      name: string;                    // 颜色名称（hex）
      count: number;                   // 使用次数
    }>;

    // 按月统计
    byMonth: Array<{
      month: string;                   // YYYY-MM
      count: number;                   // 记录数
    }>;
  };

  // === 更新日志（最近30天） ===
  updateLog: Array<{
    date: string;                      // YYYY-MM-DD
    action: 'add' | 'update' | 'delete';
    count: number;                     // 变更记录数
    description: string;               // 描述
    chunksChanged?: string[];          // 涉及的分块
    impactedUsers?: number;            // 影响用户数（预估）
  }>;

  // === 索引信息 ===
  monthList: string[];                 // 所有月份列表（降序）
  latestMonth: string;                 // 最新月份（YYYY-MM）
  oldestMonth: string;                 // 最老月份（YYYY-MM）
}

/**
 * ========== 核心功能函数 ==========
 */

/**
 * 计算内容的MD5哈希值
 *
 * 原理:
 * 1. 递归排序对象键（排除缓存字段）
 * 2. 生成标准化JSON字符串
 * 3. 计算MD5哈希（16字节转32位hex）
 */
function calculateContentHash(data: any, excludeKeys: string[] = []): string {
  // 1. 递归排序键
  const sortedKeys = Object.keys(data)
    .filter(key => !excludeKeys.includes(key))  // 排除缓存字段
    .sort();

  const sortedObject: any = {};

  sortedKeys.forEach(key => {
    const value = data[key];

    // 递归处理对象（排除undefined）
    if (typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        value.constructor === Object) {
      sortedObject[key] = calculateContentHash(value, excludeKeys);
    }
    // 保持数组（不用排序）
    else if (Array.isArray(value)) {
      sortedObject[key] = value;
    }
    // 其他非空、非函数值
    else if (value !== undefined && value !== null && typeof value !== 'function') {
      sortedObject[key] = value;
    }
  });

  // 2. 标准化: JSON字符串
  const jsonString = JSON.stringify(sortedObject);

  // 3. 计算MD5（16字节哈希转32位hex字符串）
  return crypto.createHash('md5').update(jsonString).digest('hex');
}

/**
 * 读取上次的索引数据
 *
 * 返回: IndexData | null
 */
async function readPreviousIndex(): Promise<IndexData | null> {
  try {
    const indexPath = path.join(__dirname, '../docs/index.json');

    if (!fs.existsSync(indexPath)) {
      console.log('⚠️  index.json not found, this is first run');
      return null;
    }

    const indexDataStr = await readFileAsync(indexPath, 'utf-8');
    const indexData = JSON.parse(indexDataStr) as IndexData;

    console.log(`✅ Loaded previous index: ${indexData.dataVersion}`);
    return indexData;
  } catch (error) {
    console.error('❌  Failed to read previous index:', error);
    return null;
  }
}

/**
 * 主函数
 *
 * 步骤:
 * 1. 连接数据库
 * 2. 读取上次索引
 * 3. 获取壁纸数据
 * 4. 处理壁纸数据（v3.0+优化格式）
 * 5. 按月分块
 * 6. 计算内容哈希
 * 7. 生成index.json
 * 8. 写入分块文件
 */
const main = async () => {
  console.log('🚀 Starting data generation with MD5 versioning...');
  console.time('⏱️  Total generation time');

  // 1. 连接数据库
  console.log('🔌 Connecting to database...');
  await AppDataSource.initialize();
  const imagekitRepository = AppDataSource.getRepository(Imagekit);
  console.log('✅ Database connected');

  // 2. 读取上次的索引数据
  const previousIndex = await readPreviousIndex();
  const previousChunks = previousIndex?.chunks || {};
  const previousHashes = new Map(
    Object.entries(previousChunks).map(([month, meta]) => [month, meta.hash])
  );

  // 3. 获取数据
  console.log('📊 Fetching data from database...');
  const imagekits = await imagekitRepository.find({
    order: { id: 'DESC' },
    relations: ['wallpapers', 'wallpapers.analytics'],
  });
  console.log(`✅ Fetched ${imagekits.length} records`);

  // 4. 处理壁纸数据（v3.0+优化版）
  console.log('⚙️  Processing wallpaper data...');
  const cleanWallpapers: WallpaperData[] = sortBy(
    filter(
      map(imagekits, (imagekit) => {
        const wallpapers = imagekit.wallpapers;
        const zhCNData = find(wallpapers, (w) => w.lang === 0);
        const enUSData = find(wallpapers, (w) => w.lang === 1);
        const wallpaperDate = get(zhCNData, ['date'], get(enUSData, ['date']));

        if (!wallpaperDate) return null;

        const filename = get(zhCNData, ['filename'], get(enUSData, ['filename']));
        const dominantColor = get(
          zhCNData,
          ['analytics', 'dominantColor'],
          get(enUSData, ['analytics', 'dominantColor'])
        );

        // 格式化日期（YYYYMMDD -> YYYY-MM-DD）
        const dateNum = parseInt(wallpaperDate, 10);
        const dateStr = wallpaperDate.toString();
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const dateFmt = `${year}-${month}-${day}`;

        return {
          id: filename,
          date: dateNum,
          dateFmt: dateFmt,  // 新增：格式化日期
          title: get(zhCNData, ['title'], get(enUSData, ['title'])),
          copyright: get(zhCNData, ['copyright'], get(enUSData, ['copyright'])),
          dominantColor: dominantColor || 'cccccc',
          imageUrl: `https://cn.bing.com/th?id=${filename}_UHD.jpg&w=300&c=1`,
          downloadUrl: `https://cn.bing.com/th?id=${filename}_UHD.jpg`,
        };
      }),
      (wallpaper) => wallpaper && isString(wallpaper.id) && wallpaper.id.length > 0,
    ),
    [(a: any) => a.date],  // 按日期升序
  );
  console.log(`✅ Processed ${cleanWallpapers.length} wallpapers`);

  // 5. 按月分块
  console.log('📅 Grouping by month...');
  const wallpapersGroupData: WallpapersGroupData[] = reduce(
    cleanWallpapers,
    (wallpapersReduce: any[], wallpaper: any) => {
      const dateStr = wallpaper.date.toString();
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const wallpaperGroupMonth = `${year}-${month}`;

      const wallpapersReduceMonth = wallpapersReduce.find(
        ({ groupMonth }: { groupMonth: string }) => groupMonth === wallpaperGroupMonth,
      );
      if (wallpapersReduceMonth) {
        wallpapersReduceMonth.wallpapers.push(wallpaper);
      } else {
        wallpapersReduce.push({
          groupMonth: wallpaperGroupMonth,
          wallpapers: [wallpaper],
        });
      }
      return wallpapersReduce;
    },
    [],
  );
  console.log(`✅ Grouped into ${wallpapersGroupData.length} months`);

  // 6. 计算每个分块的MD5内容哈希
  console.log('🔐 Calculating content hashes...');
  const chunkMetadata: { [month: string]: ChunkMetadata } = {};
  let totalChanged = 0;
  let totalUnchanged = 0;
  let totalBytesSaved = 0;  // 预估节省字节

  for (const group of wallpapersGroupData) {
    // 6.1 构建分块内容
    const currentContent = {
      month: group.groupMonth,
      wallpapers: group.wallpapers
    };
    const currentHash = calculateContentHash(currentContent);

    // 6.2 获取上次的哈希
    const previousHash = previousHashes.get(group.groupMonth) || null;

    // 6.3 判断是否发生变更
    const isChanged = !previousHash || previousHash !== currentHash;

    // 6.4 统计信息
    if (isChanged) {
      totalChanged++;
    } else {
      totalUnchanged++;
      // 统计预估节省（0传输）
      const estimatedSize = JSON.stringify(group.wallpapers).length;
      totalBytesSaved += estimatedSize;
    }

    // 6.5 构建元数据
    const wallpapersChecksum = calculateContentHash(group.wallpapers);
    chunkMetadata[group.groupMonth] = {
      version: `md5:${currentHash}`,
      hash: currentHash,
      updatedAt: isChanged ? new Date().toISOString() : null,
      isChanged,
      recordCount: group.wallpapers.length,
      checksum: `md5:${wallpapersChecksum}`,
      previousHash: previousHash
    };
  }

  console.log(`📊 Chunk status:`);
  console.log(`   - Changed: ${totalChanged} chunks`);
  console.log(`   - Unchanged: ${totalUnchanged} chunks`);
  console.log(`   - Bytes saved: ${(totalBytesSaved / 1024).toFixed(1)} KB`);

  // 7. 构建索引数据
  console.log('🏗️  Building index data...');

  // 颜色统计（Top 10）
  const colorCounts: Record<string, number> = {};
  cleanWallpapers.forEach(w => {
    const color = w.dominantColor;
    colorCounts[color] = (colorCounts[color] || 0) + 1;
  });
  const colors = Object.entries(colorCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 按月统计
  const monthCounts: Record<string, number> = {};
  wallpapersGroupData.forEach(group => {
    monthCounts[group.groupMonth] = group.wallpapers.length;
  });
  const byMonth = Object.entries(monthCounts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const indexData: IndexData = {
    version: '2.0',
    schemaVersion: 2,
    dataVersion: `md5:${calculateContentHash(chunkMetadata)}`,
    generatedAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    totalWallpapers: cleanWallpapers.length,
    chunks: chunkMetadata,
    stats: {
      total: cleanWallpapers.length,
      changedChunks: totalChanged,
      unchangedChunks: totalUnchanged,
      colors,
      byMonth,
    },
    monthList: wallpapersGroupData.map(g => g.groupMonth).sort((a, b) => b.localeCompare(a)),
    latestMonth: wallpapersGroupData[0]?.groupMonth || '',
    oldestMonth: wallpapersGroupData[wallpapersGroupData.length - 1]?.groupMonth || '',
    // TODO: 未来版本添加 updateLog
    updateLog: [],
  };

  // 8. 写入index.json（索引文件）
  const docsDir = path.resolve(__dirname, '../docs');
  const chunksDir = path.join(docsDir, 'chunks');

  console.log('💾 Writing index.json & NPM utils.js...');
  await mkdirAsync(chunksDir, { recursive: true });

  await writeFileAsync(
    path.join(docsDir, 'index.json'),
    JSON.stringify(indexData, null, 2)
  );

  // 写入 NPM 辅助工具 utils.js
  const utilsJsContent = `const BASE = "https://cn.bing.com/th?id=";
export const imageUrl = (id) => \`\${BASE}\${id}_UHD.jpg&w=300&c=1\`;
export const downloadUrl = (id) => \`\${BASE}\${id}_UHD.jpg\`;
export const dateFmt = (date) => {
  const s = String(date);
  if (s.length !== 8) return s;
  return \`\${s.slice(0, 4)}-\${s.slice(4, 6)}-\${s.slice(6, 8)}\`;
};
`;
  await writeFileAsync(path.join(docsDir, 'utils.js'), utilsJsContent, 'utf-8');

  // 写入 NPM 索引 index.js
  const indexJsContent = `export const version = "2.0";
export const dataVersion = "md5:${calculateContentHash(chunkMetadata)}";
export const generatedAt = "${new Date().toISOString()}";
export const totalWallpapers = ${cleanWallpapers.length};
export const monthList = ${JSON.stringify(wallpapersGroupData.map(g => g.groupMonth).sort((a,b)=>b.localeCompare(a)))};
export const latestMonth = "${wallpapersGroupData[wallpapersGroupData.length - 1]?.groupMonth || ''}";
`;
  await writeFileAsync(path.join(docsDir, 'index.js'), indexJsContent, 'utf-8');

  console.log('✅ Written indexes and utils');

  // 9. 写入发生变更的分块文件
  console.log(`💾 Writing ${totalChanged} changed chunks...`);
  const writePromises = wallpapersGroupData
    .filter(group => chunkMetadata[group.groupMonth].isChanged)
    .map(async (group) => {
      const chunkFile = path.join(chunksDir, `${group.groupMonth}.js`);

      // 生成紧凑的 NPM JS 格式
      const compactRows = group.wallpapers.map((w: any) => [
        w.id,
        w.date,
        w.title || '',
        w.copyright || '',
        w.dominantColor
      ]);
      const jsContent = `export default ${JSON.stringify(compactRows, null, 0)};\n`;
      await writeFileAsync(chunkFile, jsContent, 'utf-8');

      console.log(`   ✅ ${group.groupMonth} (${group.wallpapers.length} records)`);
    });

  await Promise.all(writePromises);

  // 10. 清理被删除的分块
  if (previousIndex?.chunks) {
    const deletedMonths = Object.keys(previousIndex.chunks)
      .filter(month => !chunkMetadata[month]);

    if (deletedMonths.length > 0) {
      console.log(`🗑️  Cleaning up ${deletedMonths.length} deleted chunks...`);
      deletedMonths.forEach(month => {
        const jsChunkFile = path.join(chunksDir, `${month}.js`);
        if (fs.existsSync(jsChunkFile)) {
          fs.unlinkSync(jsChunkFile);
          console.log(`   🗑️  Deleted ${month}`);
        }
      });
    }
  }

  // 11. 清理旧数据（wallpapers.json - 兼容性保留但标记为过时）
  const legacyWallpapersPath = path.join(docsDir, 'wallpapers.json');
  if (fs.existsSync(legacyWallpapersPath)) {
    // 添加废弃标记
    const legacyData = {
      deprecated: true,
      version: '3.0+',
      message: 'This file is deprecated. Use index.json + chunks/ instead.',
      redirectTo: 'index.json'
    };
    await writeFileAsync(legacyWallpapersPath, JSON.stringify(legacyData, null, 2));
    console.log('⚠️  Legacy wallpapers.json marked as deprecated');
  }

  // 12. 完成
  console.log('🎉 Generation complete!');
  console.log('   Summary:');
  console.log(`   - Total wallpapers: ${cleanWallpapers.length}`);
  console.log(`   - Total chunks: ${wallpapersGroupData.length}`);
  console.log(`   - Changed: ${totalChanged}, Unchanged: ${totalUnchanged}`);
  console.log(`   - Total data size: ${((totalChanged * 25 + totalUnchanged * 0) / 1024).toFixed(1)} KB (estimated)`);
  console.log(`   - Bandwidth saved: ${((totalUnchanged * 25) / 1024).toFixed(1)} KB`);
  console.timeEnd('⏱️  Total generation time');

  await AppDataSource.destroy();
};

main().catch(console.error);
