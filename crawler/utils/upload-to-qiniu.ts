import 'reflect-metadata';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * 七牛云对象存储（KODO）冷备份封装
 * ------------------------------------------------------------------
 * 设计定位（务必牢记）：
 *   - 七牛在本项目中【仅作冷备份存储】，不承担日常分发。
 *   - 前端图片默认走 Bing 源头（cn.bing.com），只有源头失效时才在
 *     浏览器侧 onError 逐级降级到七牛备份，因此常态下七牛零流量、月费≈0。
 *
 * 铁律（Inversion / FMEA）：
 *   - 本模块【永不 throw】。备份是尽力而为（best-effort），任何失败
 *     （未配置、未安装 qiniu、网络错误、鉴权错误）都只返回结果对象，
 *     绝不允许中断已运行 9 年的每日采集主流程。
 *   - 未配置七牛环境变量时【完全惰性】：连 qiniu 包都不会被 import，
 *     因此即使尚未 `pnpm add qiniu`，主流程也不受任何影响。
 *
 * 契约（跨端对齐，见 crawler/makePreviewJSON.ts:263 与
 * website/src/utils/unpackChunk.ts）：
 *   - 备份对象 key   = `bing-wallpaper/${filename}.jpg`
 *   - 备份来源 URL   = `https://cn.bing.com/th?id=${filename}_UHD.jpg`
 *   - 前端兜底 URL   = `${QINIU_DOMAIN}/bing-wallpaper/${filename}.jpg`
 *   其中 filename 即 Bing 的 OHR token（= DB.wallpaper.filename = 前端 chunk.id）。
 *
 * 所需环境变量：
 *   QINIU_ACCESS_KEY  必填
 *   QINIU_SECRET_KEY  必填
 *   QINIU_BUCKET      必填，备份桶名
 *   QINIU_DOMAIN      选填（仅前端拼 URL 用，本模块不依赖）
 *   QINIU_ZONE        选填，桶所在区域：z0(华东) z1(华北) z2(华南) na0(北美) as0(东南亚)
 */

// ------------------------------------------------------------------
// 七牛 SDK 的最小类型描述（局部声明，避免对未安装的 `qiniu` 做静态解析）
// 仅声明本模块实际用到的成员，杜绝 any 泄漏到导出面。
// ------------------------------------------------------------------
interface QiniuMac {
  readonly __brand?: 'QiniuMac';
}

interface QiniuRespInfo {
  statusCode: number;
}

type QiniuCallback = (
  err: Error | null,
  respBody: unknown,
  respInfo: QiniuRespInfo,
) => void;

interface QiniuBucketManager {
  stat: (bucket: string, key: string, cb: QiniuCallback) => void;
  fetch: (resUrl: string, bucket: string, key: string, cb: QiniuCallback) => void;
}

interface QiniuConfig {
  zone?: unknown;
  useHttpsDomain?: boolean;
}

interface QiniuModule {
  auth: { digest: { Mac: new (ak: string, sk: string) => QiniuMac } };
  conf: { Config: new () => QiniuConfig };
  rs: {
    BucketManager: new (mac: QiniuMac, config: QiniuConfig) => QiniuBucketManager;
  };
  zone?: Record<string, unknown>;
}

export type QiniuBackupStatus = 'uploaded' | 'exists' | 'skipped' | 'error';

export interface QiniuBackupResult {
  status: QiniuBackupStatus;
  key: string;
  reason?: string;
}

const QINIU_KEY_PREFIX = 'bing-wallpaper';

/**
 * 由 Bing filename（OHR token）推导备份对象 key。
 * 与前端 unpackChunk.ts 的 backupUrl 保持严格一致。
 */
export const toQiniuKey = (filename: string): string =>
  `${QINIU_KEY_PREFIX}/${filename}.jpg`;

/**
 * 由 Bing filename 推导备份来源 URL（与 ImageKit 上传同源，取 UHD 原图）。
 */
const toBingSourceUrl = (filename: string): string =>
  `https://cn.bing.com/th?id=${filename}_UHD.jpg`;

/**
 * 是否已配置七牛备份（三要素齐全）。未配置则整条备份链路惰性关闭。
 */
export const isQiniuConfigured = (): boolean =>
  Boolean(
    process.env.QINIU_ACCESS_KEY &&
      process.env.QINIU_SECRET_KEY &&
      process.env.QINIU_BUCKET,
  );

// 进程内只提示一次"未配置/未安装"，避免刷屏
let hasWarnedUnavailable = false;
const warnOnce = (message: string): void => {
  if (!hasWarnedUnavailable) {
    hasWarnedUnavailable = true;
    console.log(
      `>>> [QINIU] ${message}（本次运行仅提示一次，备份将被跳过，不影响主流程）`,
    );
  }
};

/**
 * 惰性加载 qiniu 包。使用变量说明符规避 TS 对未安装包的静态解析报错；
 * 结果先落到 unknown 再收窄，杜绝 any。加载失败返回 null（视作"未安装"）。
 */
const loadQiniu = async (): Promise<QiniuModule | null> => {
  try {
    const packageName = 'qiniu';
    const loaded: unknown = await import(packageName);
    // ESM/CJS 互操作：qiniu 为 CJS，可能被包在 default 上
    const record =
      loaded && typeof loaded === 'object'
        ? (loaded as Record<string, unknown>)
        : null;
    const mod = record && 'default' in record ? record.default : loaded;
    return mod as QiniuModule;
  } catch {
    return null;
  }
};

let cachedBucketManager: QiniuBucketManager | null = null;
let cachedBucket = '';

const getBucketManager = async (): Promise<{
  bucketManager: QiniuBucketManager;
  bucket: string;
} | null> => {
  if (cachedBucketManager) {
    return { bucketManager: cachedBucketManager, bucket: cachedBucket };
  }

  const qiniu = await loadQiniu();
  if (qiniu === null) {
    warnOnce('未检测到 qiniu 依赖，请在就绪后执行 `pnpm add qiniu`');
    return null;
  }

  const accessKey = process.env.QINIU_ACCESS_KEY as string;
  const secretKey = process.env.QINIU_SECRET_KEY as string;
  const bucket = process.env.QINIU_BUCKET as string;

  const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
  const config = new qiniu.conf.Config();
  config.useHttpsDomain = true;

  // 可选：显式指定区域（不指定时新版 SDK 会依据 bucket 自动探测）
  const zoneName = process.env.QINIU_ZONE;
  if (zoneName && qiniu.zone) {
    const zoneKey = `Zone_${zoneName}`;
    const zone = qiniu.zone[zoneKey];
    if (zone) {
      config.zone = zone;
    }
  }

  cachedBucketManager = new qiniu.rs.BucketManager(mac, config);
  cachedBucket = bucket;
  return { bucketManager: cachedBucketManager, bucket };
};

/**
 * 判断对象是否已存在于备份桶（幂等去重的依据 —— "桶即账本"）。
 */
const statExists = (
  bucketManager: QiniuBucketManager,
  bucket: string,
  key: string,
): Promise<boolean> =>
  new Promise((resolve) => {
    bucketManager.stat(bucket, key, (err, _body, info) => {
      if (!err && info && info.statusCode === 200) {
        resolve(true);
        return;
      }
      resolve(false);
    });
  });

/**
 * 让七牛服务端直接从 Bing 抓取图片存入桶（server-side fetch，零本地带宽）。
 */
const fetchIntoBucket = (
  bucketManager: QiniuBucketManager,
  params: { resUrl: string; bucket: string; key: string },
): Promise<QiniuRespInfo> =>
  new Promise((resolve, reject) => {
    bucketManager.fetch(params.resUrl, params.bucket, params.key, (err, _body, info) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(info);
    });
  });

/**
 * 将某张壁纸的 UHD 原图冷备份到七牛桶（幂等、best-effort、永不 throw）。
 *
 * @param filename Bing 的 OHR token（= DB.wallpaper.filename = 前端 chunk.id）
 * @returns 备份结果，供调用方记录日志；调用方无需 try/catch。
 */
export const backupToQiniu = async (
  filename: string,
): Promise<QiniuBackupResult> => {
  const key = toQiniuKey(filename);

  if (typeof filename !== 'string' || filename.length === 0) {
    return { status: 'skipped', key, reason: 'invalid-filename' };
  }

  if (!isQiniuConfigured()) {
    warnOnce('未配置 QINIU_ACCESS_KEY/QINIU_SECRET_KEY/QINIU_BUCKET');
    return { status: 'skipped', key, reason: 'not-configured' };
  }

  try {
    const ctx = await getBucketManager();
    if (ctx === null) {
      return { status: 'skipped', key, reason: 'qiniu-unavailable' };
    }
    const { bucketManager, bucket } = ctx;

    // 幂等：已存在则跳过（桶即账本，天然去重，无需 DB 字段）
    if (await statExists(bucketManager, bucket, key)) {
      return { status: 'exists', key };
    }

    const info = await fetchIntoBucket(bucketManager, {
      resUrl: toBingSourceUrl(filename),
      bucket,
      key,
    });

    if (info && info.statusCode === 200) {
      return { status: 'uploaded', key };
    }
    return {
      status: 'error',
      key,
      reason: `fetch-status-${info ? info.statusCode : 'unknown'}`,
    };
  } catch (error) {
    // 任何异常都被吞掉，仅返回错误结果，绝不冒泡影响主流程
    const reason = error instanceof Error ? error.message : String(error);
    return { status: 'error', key, reason };
  }
};

export default backupToQiniu;
