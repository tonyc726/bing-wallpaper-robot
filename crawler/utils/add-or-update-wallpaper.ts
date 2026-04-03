import 'reflect-metadata';
import 'sqlite3';
import * as fs from 'fs';
import * as pfs from 'fs/promises';
import * as path from 'path';
import { get, isEmpty, pickBy, identity, isNil, isString } from 'lodash';
import { Not, IsNull } from 'typeorm';
import { fileTypeFromStream } from 'file-type';

import AppDataSource from '../database';
import { Wallpaper, Analytics, Imagekit } from '../models';
import langEnum from './lang-enum';
import transformFilenameToHashId from './transform-filename-to-hash-id';
import transformFilenameFromUrlbase from './transform-filename-from-urlbase';
import downloadImage from './download-image';
import execPython from './exec-python';
import isSimilarImage, { colorHistDist } from './is-similar-image';
import uploadToImagekit from './upload-to-imagekit';
import { downloadTo } from './download-thumbnail';

/**
 * 新增或者更新 Bing壁纸 数据
 * @doc https://typeorm.io/#/repository-api
 *
 * @param {Object} wallpaperBingData
 *
 * @param repositories
 * @returns {Promise} wallpaper最新的数据
 *
 */
// eslint-disable-next-line complexity
export default async (
  wallpaperBingData: any,
  repositories?: {
    wallpaper: any;
    analytics: any;
    imagekit: any;
  },
) => {
  if (isEmpty(wallpaperBingData)) {
    throw new Error('addOrUpdateWallpaper: must need one valid wallpaper data from bing.com');
  }
  let wallpaperRepository = get(repositories, ['wallpaper']);
  let analyticsRepository = get(repositories, ['analytics']);
  let imagekitRepository = get(repositories, ['imagekit']);
  if (
    isEmpty(repositories) ||
    isEmpty(wallpaperRepository) ||
    isEmpty(analyticsRepository) ||
    isEmpty(imagekitRepository)
  ) {
    await AppDataSource.initialize();

    if (isEmpty(wallpaperRepository)) {
      wallpaperRepository = AppDataSource.getRepository(Wallpaper);
    }
    if (isEmpty(analyticsRepository)) {
      analyticsRepository = AppDataSource.getRepository(Analytics);
    }
    if (isEmpty(imagekitRepository)) {
      imagekitRepository = AppDataSource.getRepository(Imagekit);
    }
  }

  const wallpaperFilename = transformFilenameFromUrlbase(wallpaperBingData.urlbase || wallpaperBingData['u,rlbase']);
  if (isString(wallpaperFilename) === false || wallpaperFilename.length === 0) {
    console.log(`--- wallpaperBingData ---
${JSON.stringify(wallpaperBingData, null, 2)}
    --- <<<<<<<<<< ---`);
    throw new Error('addOrUpdateWallpaper: wallpaperFilename is invaild.');
  }
  const prevWallpaper = await wallpaperRepository.findOne({
    where: {
      filename: wallpaperFilename,
    },
    relations: ['analytics', 'imagekit'],
  });

  let nextWallpaper = prevWallpaper;

  if (isEmpty(prevWallpaper)) {
    // * ----------------
    // * >>> 新建 <<<
    // * 一共 5 个阶段
    // * ----------------
    console.log(`>> 新增 ${wallpaperFilename}...`);

    // [STAGE.1] >> 下载缩率图
    console.log(`>>> [STAGE.1] >> 下载缩率图...`);
    const thumbImageWidth = 256;
    const thumbImageUrl = `https://cn.bing.com/th?id=${wallpaperFilename}_UHD.jpg&w=${thumbImageWidth}&c=1`;

    const thumbTmpImageFileName = transformFilenameToHashId(wallpaperFilename);
    const thumbTmpImageFilePath = path.resolve(__dirname, '../../docs/thumbs/', `${thumbTmpImageFileName}.jpg`);

    let thumbTmpImageStat = null;
    let thumbTmpImageStatRetryCount = 0;

    do {
      try {
        thumbTmpImageStat = await downloadImage(thumbImageUrl, thumbTmpImageFilePath);
      } catch (error) {
        thumbTmpImageStatRetryCount = thumbTmpImageStatRetryCount + 1;
      }
    } while (thumbTmpImageStat === null && thumbTmpImageStatRetryCount < 5);

    if (thumbTmpImageStat === null) {
      throw new Error(`addOrUpdateWallpaper: download image(${thumbImageUrl}) failed.`);
    }

    // [STAGE.2] >> 使用python分析下载的缩率图
    // 获取`aHash`、`dHash`、`wHash`、`pHash`、`dominantColor`数据
    console.log(`>>> [STAGE.2] >> 使用python分析下载的缩率图...`);
    let thumbImageAnalytics = null;
    let thumbImageAnalyticsRetryCount = 0;

    do {
      try {
        thumbImageAnalytics = await execPython('./crawler/getImageHash.py', thumbTmpImageFilePath);

        thumbImageAnalytics = JSON.parse(thumbImageAnalytics);
      } catch (error) {
        thumbImageAnalyticsRetryCount = thumbImageAnalyticsRetryCount + 1;
      }
    } while (thumbImageAnalytics === null && thumbImageAnalyticsRetryCount < 5);

    if (thumbImageAnalytics === null) {
      // 删除临时文件
      await pfs.rm(thumbTmpImageFilePath);
      throw new Error(`addOrUpdateWallpaper: get analytics of image(${thumbImageUrl}) use python failed.`);
    }

    // [STAGE.2-B] >> 计算颜色直方图（用于颜色预过滤）
    console.log(`>>> [STAGE.2-B] >> 计算颜色直方图...`);
    let colorHistJson: string | null = null;
    try {
      const colorHistResult = await execPython('./crawler/computeColorHist.py', thumbTmpImageFilePath);
      const colorHistData = JSON.parse(colorHistResult);
      if (colorHistData.colorHist) {
        colorHistJson = JSON.stringify(colorHistData.colorHist);
      }
    } catch (e) {
      console.log(`>>> [STAGE.2-B] colorHist computation skipped: ${e}`);
    }

    // [STAGE.3] >> 新建分析数据的对象，并保存上一阶段的分析结果
    console.log(`>>> [STAGE.3] >> 新建分析数据的对象，并保存上一阶段的分析结果...`);
    const analytics = new Analytics();
    analytics.aHash = thumbImageAnalytics.aHash;
    analytics.dHash = thumbImageAnalytics.dHash;
    analytics.wHash = thumbImageAnalytics.wHash;
    analytics.pHash = thumbImageAnalytics.pHash;
    analytics.dominantColor = thumbImageAnalytics.dominantColor;
    if (colorHistJson !== null) {
      analytics.colorHist = colorHistJson;
    }

    await analyticsRepository.save(analytics);

    // [STAGE.4] >> 三阶段去重检测
    // Phase 1: 哈希预过滤
    // Phase 1.5: 颜色直方图过滤
    // Phase 2: SSIM 精细确认
    console.log(`>>> [STAGE.4] >> 获取已有壁纸数据（包含分析数据），开始三阶段去重检测...`);
    const existingWallpapers = await wallpaperRepository.find({
      order: {
        date: 'DESC',
      },
      where: {
        analytics: Not(IsNull()),
      },
      relations: ['analytics', 'imagekit'],
    });

    // 通过汉明距离检测相似图片
    let similarWallpaper: any = null;
    let similarWallpaperImageKit: any = null;
    const SSIM_THRESHOLD = 0.85;
    const COLOR_HIST_THRESHOLD = 0.3;

    if (existingWallpapers.length > 0) {
      for (const existingWallpaper of existingWallpapers) {
        const existingAnalytics = get(existingWallpaper, ['analytics']);
        if (
          !existingAnalytics ||
          !existingAnalytics.pHash ||
          !existingAnalytics.wHash ||
          !existingAnalytics.aHash ||
          !existingAnalytics.dHash ||
          !analytics.aHash ||
          !analytics.dHash ||
          !analytics.wHash ||
          !analytics.pHash
        ) {
          continue;
        }

        // ----- Phase 1: 哈希预过滤 -----
        if (
          !isSimilarImage(
            {
              pHash: existingAnalytics.pHash,
              wHash: existingAnalytics.wHash,
              aHash: existingAnalytics.aHash,
              dHash: existingAnalytics.dHash,
            },
            {
              pHash: analytics.pHash,
              wHash: analytics.wHash,
              aHash: analytics.aHash,
              dHash: analytics.dHash,
            },
          )
        ) {
          continue;
        }

        // ----- Phase 1.5: 颜色直方图过滤 -----
        if (existingAnalytics.colorHist && analytics.colorHist) {
          try {
            const histA = JSON.parse(existingAnalytics.colorHist) as number[];
            const histB = JSON.parse(analytics.colorHist) as number[];
            const dist = colorHistDist(histA, histB);
            if (dist > COLOR_HIST_THRESHOLD) {
              continue;
            }
          } catch {
            // 解析失败，跳过颜色检查继续
          }
        }

        // ----- Phase 2: SSIM 精细确认 -----
        let ssimConfirmed = true;
        try {
          const existingFilename = get(existingWallpaper, ['filename']);
          if (existingFilename) {
            const existingThumbUrl = `https://cn.bing.com/th?id=${existingFilename}_UHD.jpg&w=256&c=1`;
            const tmpPath = `/tmp/ssim-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            await downloadTo(existingThumbUrl, tmpPath);
            const ssimResult = await execPython('./crawler/ssim-compare.py', `${thumbTmpImageFilePath} ${tmpPath}`);
            const ssimData = JSON.parse(ssimResult);
            if (ssimData.ssim !== undefined) {
              ssimConfirmed = ssimData.ssim >= SSIM_THRESHOLD;
              console.log(`>>> [STAGE.4-B] SSIM=${ssimData.ssim.toFixed(3)} MAE=${ssimData.mae.toFixed(1)} confirmed=${ssimConfirmed}`);
            }
            try {
              fs.unlinkSync(tmpPath);
            } catch {}
          }
        } catch (ssimError) {
          console.log(`>>> [STAGE.4-B] SSIM comparison failed, falling back to hash+color: ${ssimError}`);
          ssimConfirmed = true;
        }

        if (ssimConfirmed) {
          similarWallpaper = existingWallpaper;
          similarWallpaperImageKit = get(existingWallpaper, ['imagekit']);
          break;
        }
      }
    }

    let imagekit = null;
    // 如果无相似图片，需要新建imagekit，同时上传图片
    if (similarWallpaperImageKit === null) {
      console.log(`>>> [STAGE.4] >> 检测无相似图片，开始上传imagekit...`);

      let imagekitUploadFile = null;
      let imagekitUploadFileRetryCount = 0;

      do {
        try {
          // 上传图片至 imagekit
          imagekitUploadFile = await uploadToImagekit(wallpaperFilename, transformFilenameToHashId(wallpaperFilename));
        } catch (error) {
          imagekitUploadFileRetryCount = imagekitUploadFileRetryCount + 1;
        }
      } while (imagekitUploadFile === null && imagekitUploadFileRetryCount < 5);

      if (imagekitUploadFile === null) {
        // 清理已经入库的分析数据
        await analyticsRepository.remove(analytics);

        throw new Error(`addOrUpdateWallpaper: upload image(${thumbImageUrl}) to imagekit failed.`);
      }

      imagekit = new Imagekit();
      imagekit.fileId = imagekitUploadFile.fileId;
      imagekit.fileName = imagekitUploadFile.name;
      imagekit.height = imagekitUploadFile.height;
      imagekit.width = imagekitUploadFile.width;
      await imagekitRepository.save(imagekit);
    } else {
      console.log(`>>> [STAGE.4] >> 检测到相似图片（${similarWallpaper!.filename}）...`);
      imagekit = similarWallpaperImageKit!;
    }

    const thumbTmpImageReadStream = fs.createReadStream(thumbTmpImageFilePath);
    const thumbTmpImageType = await fileTypeFromStream(thumbTmpImageReadStream);

    // 重命名此前的临时文件，转移至永久保存路径
    await pfs.rename(
      thumbTmpImageFilePath,
      path.resolve(__dirname, '../../docs/thumbs/', `${imagekit.id}.${get(thumbTmpImageType, ['ext'], 'jpg')}`),
    );

    // [STAGE.5] >> 新建壁纸对象，并保存
    console.log(`>>> [STAGE.5] >> 新建壁纸对象，并保存...`);
    const wallpaper = new Wallpaper();
    wallpaper.date = get(wallpaperBingData, ['startdate']);
    wallpaper.title = get(wallpaperBingData, ['title']);
    wallpaper.lang = ((urlbase) => {
      let langCode = langEnum['en-US'];
      if (/zh-cn/gi.test(urlbase)) {
        langCode = langEnum['zh-CN'];
      } else if (/en-us/gi.test(urlbase)) {
        langCode = langEnum['en-US'];
      }
      return langCode;
    })(get(wallpaperBingData, ['urlbase']));
    wallpaper.filename = wallpaperFilename;
    wallpaper.copyright = get(wallpaperBingData, ['copyright']);
    wallpaper.copyrightlink = get(wallpaperBingData, ['copyrightlink']);
    wallpaper.quiz = get(wallpaperBingData, ['quiz']);

    wallpaper.ext = get(thumbTmpImageType, ['ext'], 'jpg');
    wallpaper.mime = get(thumbTmpImageType, ['mime']) || null;
    wallpaper.analytics = analytics;
    wallpaper.imagekit = imagekit;

    nextWallpaper = await wallpaperRepository.save(wallpaper);
  } else {
    // * ----------------
    // * >>> 更新 <<<
    // * 更新壁纸的基本信息
    // * 以及检查是否有分析数据
    // * ----------------
    console.log(`>> 更新 ${wallpaperFilename}...`);

    // [STAGE.1] >> 依据请求数据，重组壁纸基本信息
    console.log(`>>> [STAGE.1] >> 依据请求数据，重组壁纸基本信息...`);
    const nextWallpaperInfo = {
      date: get(wallpaperBingData, ['startdate']),
      title: get(wallpaperBingData, ['title']),
      lang: ((urlbase) => {
        let langNum;
        if (/zh-cn/gi.test(urlbase)) {
          langNum = langEnum['zh-CN'];
        } else if (/en-us/gi.test(urlbase)) {
          langNum = langEnum['en-US'];
        }
        return langNum;
      })(get(wallpaperBingData, ['urlbase'])),
      copyright: get(wallpaperBingData, ['copyright']),
      copyrightlink: get(wallpaperBingData, ['copyrightlink']),
      quiz: get(wallpaperBingData, ['quiz']),
    };

    // [STAGE.2] >> 更新壁纸对象
    console.log(`>>> [STAGE.2] >> 更新壁纸对象...`);
    await wallpaperRepository.update(prevWallpaper.id, pickBy(nextWallpaperInfo, identity));
    nextWallpaper = await wallpaperRepository.findOne({
      where: { id: prevWallpaper.id },
      relations: ['analytics', 'imagekit'],
    });

    // [STAGE.3] >> 检查壁纸对象中的分析数据是否齐全
    // 获取`aHash`、`dHash`、`wHash`、`pHash`、`dominantColor`数据
    if (
      isEmpty(get(nextWallpaper, ['analytics'])) ||
      isNil(get(nextWallpaper, ['analytics', 'aHash'])) ||
      isNil(get(nextWallpaper, ['analytics', 'dHash'])) ||
      isNil(get(nextWallpaper, ['analytics', 'wHash'])) ||
      isNil(get(nextWallpaper, ['analytics', 'pHash'])) ||
      isNil(get(nextWallpaper, ['analytics', 'dominantColor'])) ||
      isNil(get(nextWallpaper, ['ext'])) ||
      isNil(get(nextWallpaper, ['mime']))
    ) {
      // [STAGE.3-1] >> 下载缩率图
      console.log(`>>> [STAGE.3-1] >> 下载缩率图...`);
      const thumbImageWidth = 256;
      const thumbImageUrl = `https://cn.bing.com/th?id=${wallpaperFilename}_UHD.jpg&w=${thumbImageWidth}&c=1`;

      const thumbTmpImageFileName = transformFilenameToHashId(wallpaperFilename);
      const thumbTmpImageFilePath = path.resolve(__dirname, '../../docs/thumbs/', `${thumbTmpImageFileName}.jpg`);

      let thumbTmpImageStat = null;
      let thumbTmpImageStatRetryCount = 0;

      do {
        try {
          thumbTmpImageStat = await downloadImage(thumbImageUrl, thumbTmpImageFilePath);
        } catch (error) {
          thumbTmpImageStatRetryCount = thumbTmpImageStatRetryCount + 1;
        }
      } while (thumbTmpImageStat === null && thumbTmpImageStatRetryCount < 5);

      if (thumbTmpImageStat === null) {
        throw new Error(`addOrUpdateWallpaper: download image(${thumbImageUrl}) failed.`);
      }

      const thumbTmpImageReadStream = fs.createReadStream(thumbTmpImageFilePath);
      const thumbTmpImageType = await fileTypeFromStream(thumbTmpImageReadStream);

      if (
        (isNil(get(nextWallpaper, ['ext'])) || isNil(get(nextWallpaper, ['mime']))) &&
        (isNil(get(thumbTmpImageType, ['ext'])) === false || isNil(get(thumbTmpImageType, ['mime'])) === false)
      ) {
        await wallpaperRepository.update(
          nextWallpaper.id,
          pickBy(
            {
              ext: get(thumbTmpImageType, ['ext']),
              mime: get(thumbTmpImageType, ['mime']) || null,
            },
            identity,
          ),
        );
        nextWallpaper = await wallpaperRepository.findOne({
          where: { id: prevWallpaper.id },
          relations: ['analytics', 'imagekit'],
        });
      }

      // [STAGE.3-2] >> 使用python分析下载的缩率图
      // 获取`aHash`、`dHash`、`wHash`、`pHash`、`dominantColor`数据
      console.log(`>>> [STAGE.3-2] >> 使用python分析下载的缩率图...`);
      let thumbImageAnalytics = null;
      let thumbImageAnalyticsRetryCount = 0;

      do {
        try {
          thumbImageAnalytics = await execPython('./crawler/getImageHash.py', thumbTmpImageFilePath);

          thumbImageAnalytics = JSON.parse(thumbImageAnalytics);
        } catch (error) {
          thumbImageAnalyticsRetryCount = thumbImageAnalyticsRetryCount + 1;
        }
      } while (thumbImageAnalytics === null && thumbImageAnalyticsRetryCount < 5);

      if (thumbImageAnalytics === null) {
        throw new Error(`addOrUpdateWallpaper: get analytics of image(${thumbImageUrl}) use python failed.`);
      }

      // [STAGE.3-3] >> 计算颜色直方图
      let colorHistJson: string | null = null;
      try {
        const colorHistResult = await execPython('./crawler/computeColorHist.py', thumbTmpImageFilePath);
        const colorHistData = JSON.parse(colorHistResult);
        if (colorHistData.colorHist) {
          colorHistJson = JSON.stringify(colorHistData.colorHist);
        }
      } catch (e) {
        console.log(`>>> [STAGE.3-3] colorHist computation skipped: ${e}`);
      }

      // [STAGE.3-4] >> 更新分析数据的对象
      console.log(`>>> [STAGE.3-4] >> 更新分析数据的对象...`);
      const updateData: Record<string, any> = {
        aHash: thumbImageAnalytics.aHash,
        dHash: thumbImageAnalytics.dHash,
        wHash: thumbImageAnalytics.wHash,
        pHash: thumbImageAnalytics.pHash,
        dominantColor: thumbImageAnalytics.dominantColor,
      };
      if (colorHistJson !== null) {
        updateData.colorHist = colorHistJson;
      }
      await analyticsRepository.update(
        get(nextWallpaper, ['analytics', 'id']),
        pickBy(updateData, identity),
      );

      // 依据壁纸`imagekit.id`，已经存在时，持久化存储缩略图，否则删除临时图片
      if (isString(get(nextWallpaper, ['imagekit', 'id']))) {
        // 重命名此前的临时文件，转移至永久保存路径
        await pfs.rename(
          thumbTmpImageFilePath,
          path.resolve(
            __dirname,
            '../../docs/thumbs/',
            `${get(nextWallpaper, ['imagekit', 'id'])}.${get(thumbTmpImageType, ['ext'], 'jpg')}`,
          ),
        );
      } else {
        // 删除临时文件
        await pfs.rm(thumbTmpImageFilePath);
      }
    }
  }
  return nextWallpaper;
};
