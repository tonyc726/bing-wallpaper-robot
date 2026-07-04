import 'reflect-metadata';
import 'sqlite3';
import AppDataSource from './database';
import { Wallpaper } from './models';
import backupToQiniu, { isQiniuConfigured } from './utils/upload-to-qiniu';

/**
 * 七牛冷备份 · 存量回填脚本
 * ------------------------------------------------------------------
 * 用途：把数据库里【已有的全部壁纸】的 UHD 原图，逐张幂等回填到七牛备份桶。
 *       用于首次启用七牛备份、或补齐历史缺口。可安全重复运行。
 *
 * 幂等性：backupToQiniu 内部先 stat 判存，已存在则跳过（"桶即账本"），
 *         因此重复执行不会重复上传、不产生额外流量。
 *
 * 前置：需先 `pnpm add qiniu` 并在 .env 配置
 *       QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET（可选 QINIU_ZONE）。
 *
 * 运行：
 *   pnpm exec ts-node crawler/backfill-qiniu.ts
 *   # 或限制数量（调试）：BACKFILL_LIMIT=50 pnpm exec ts-node crawler/backfill-qiniu.ts
 */

// 并发度：七牛 fetch 为 server-side 抓取，适度并发即可；过高易触发风控/限速。
const CONCURRENCY = 5;

interface BackfillStats {
  uploaded: number;
  exists: number;
  skipped: number;
  error: number;
}

/**
 * 以固定并发度遍历执行，避免一次性打满连接。
 */
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runNext = async (): Promise<void> => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      await worker(items[current], current);
    }
  };
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    runNext(),
  );
  await Promise.all(runners);
}

async function main(): Promise<void> {
  if (!isQiniuConfigured()) {
    console.error(
      '❌ 未配置七牛环境变量（QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET）。',
    );
    console.error('   请先在 .env 中填写后再运行本回填脚本。');
    process.exitCode = 1;
    return;
  }

  await AppDataSource.initialize();
  try {
    const wallpaperRepository = AppDataSource.getRepository(Wallpaper);
    const wallpapers = await wallpaperRepository.find({
      select: ['id', 'filename'],
      order: { date: 'DESC' },
    });

    const limitEnv = process.env.BACKFILL_LIMIT;
    const limit = limitEnv ? Number(limitEnv) : 0;
    const targets = (limit > 0 ? wallpapers.slice(0, limit) : wallpapers).filter(
      (wallpaper) =>
        typeof wallpaper.filename === 'string' && wallpaper.filename.length > 0,
    );

    console.log(
      `🚀 七牛冷备份回填开始：共 ${targets.length} 张待处理（并发 ${CONCURRENCY}）...`,
    );

    const stats: BackfillStats = { uploaded: 0, exists: 0, skipped: 0, error: 0 };
    let processed = 0;

    await runPool(targets, CONCURRENCY, async (wallpaper) => {
      const result = await backupToQiniu(wallpaper.filename);
      stats[result.status] += 1;
      processed += 1;

      if (result.status === 'uploaded') {
        console.log(`  ✅ [${processed}/${targets.length}] 已备份 ${result.key}`);
      } else if (result.status === 'error') {
        console.log(
          `  ⚠️  [${processed}/${targets.length}] 失败 ${result.key} — ${result.reason}`,
        );
      } else if (processed % 100 === 0) {
        // exists/skipped 静默，仅每 100 张打一次进度心跳
        console.log(`  … 进度 ${processed}/${targets.length}`);
      }
    });

    console.log('\n📊 回填完成汇总：');
    console.log(`   新上传 uploaded : ${stats.uploaded}`);
    console.log(`   已存在 exists   : ${stats.exists}`);
    console.log(`   已跳过 skipped  : ${stats.skipped}`);
    console.log(`   失败   error    : ${stats.error}`);

    if (stats.error > 0) {
      console.log('\n💡 存在失败项，可直接重跑本脚本（幂等，已备份的会自动跳过）。');
      process.exitCode = 1;
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('回填脚本异常终止：', error);
  process.exitCode = 1;
});
