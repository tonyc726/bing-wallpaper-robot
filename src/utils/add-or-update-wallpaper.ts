import 'reflect-metadata';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pick, get, isEmpty, pickBy, identity, some, isNil, isString } from 'lodash';
import { createConnection, Not, IsNull } from 'typeorm';

import { Wallpaper, Analytics, Imagekit } from '../models';
import langEnum from './lang-enum';
import transfromFilenameToHashId from './transfrom-filename-to-hash-id';
import transfromFilenameFromUrlbase from './transfrom-filename-from-urlbase';
import downloadImage from './download-image';
import execPython from './exec-python';
import isSimilarImage from './is-similar-image';
import uploadToImagekit from './upload-to-imagekit';

/**
 * 新增或者更新 Bing壁纸 数据
 * @doc https://typeorm.io/#/repository-api
 *
 * @param {Object} wallpaperBingData
 *
 * @returns {Promise} wallpaper最新的数据
 *
 */
// eslint-disable-next-line complexity
export default async (
  wallpaperBingData: any,
  repositorys?: {
    wallpaper: any;
    analytics: any;
    imagekit: any;
  },
) => {
  if (isEmpty(wallpaperBingData)) {
    throw new Error('addOrUpdateWallpaper: must need one vailded wallpaper data from bing.com');
  }
  let databaseConnection = null;
  let wallpaperRepository = get(repositorys, ['wallpaper']);
  let analyticsRepository = get(repositorys, ['analytics']);
  let imagekitRepository = get(repositorys, ['imagekit']);
  if (
    isEmpty(repositorys) ||
    isEmpty(wallpaperRepository) ||
    isEmpty(analyticsRepository) ||
    isEmpty(imagekitRepository)
  ) {
    databaseConnection = await createConnection();

    if (isEmpty(wallpaperRepository)) {
      wallpaperRepository = databaseConnection.getRepository(Wallpaper);
    }
    if (isEmpty(analyticsRepository)) {
      analyticsRepository = databaseConnection.getRepository(Analytics);
    }
    if (isEmpty(imagekitRepository)) {
      imagekitRepository = databaseConnection.getRepository(Imagekit);
    }
  }

  const wallpaperFilename = transfromFilenameFromUrlbase(wallpaperBingData.urlbase);
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
    console.log(`
>> 新增 ${wallpaperFilename}...`);

    // [STAGE.1] >> 下载缩率图
    console.log(`>>> [STAGE.1] >> 下载缩率图...`);
    const thumbImageWidth = 256;
    const thumbImageUrl = `https://cn.bing.com/th?id=${wallpaperFilename}_UHD.jpg&w=${thumbImageWidth}&c=1`;

    const thumbTmpImageFileName = transfromFilenameToHashId(wallpaperFilename);
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
        thumbImageAnalytics = await execPython('./src/getImageHash.py', thumbTmpImageFilePath);

        thumbImageAnalytics = JSON.parse(thumbImageAnalytics);
      } catch (error) {
        thumbImageAnalyticsRetryCount = thumbImageAnalyticsRetryCount + 1;
      }
    } while (thumbImageAnalytics === null && thumbImageAnalyticsRetryCount < 5);

    if (thumbImageAnalytics === null) {
      throw new Error(`addOrUpdateWallpaper: get analytics of image(${thumbImageUrl}) use python failed.`);
    }

    // [STAGE.3] >> 新建分析数据的对象，并保存上一阶段的分析结果
    console.log(`>>> [STAGE.3] >> 新建分析数据的对象，并保存上一阶段的分析结果...`);
    const analytics = new Analytics();
    analytics.aHash = thumbImageAnalytics.aHash;
    analytics.dHash = thumbImageAnalytics.dHash;
    analytics.wHash = thumbImageAnalytics.wHash;
    analytics.pHash = thumbImageAnalytics.pHash;
    analytics.dominantColor = thumbImageAnalytics.dominantColor;

    await analyticsRepository.save(analytics);

    // [STAGE.4] >> 获取已有壁纸数据（包含分析数据）
    // 同时通过计算`aHash`、`dHash`、`wHash`、`pHash`的汉明距离
    // 寻找相似图片，用于同一图片爬取多次时的去重工作
    console.log(`>>> [STAGE.4] >> 获取已有壁纸数据（包含分析数据）...`);
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
    let similarWallpaper = null;
    let similarWallpaperImageKit = null;
    if (existingWallpapers.length > 0) {
      existingWallpapers.forEach((existingWallpaper) => {
        if (
          isSimilarImage(pick(get(existingWallpaper, ['analytics']), ['pHash', 'wHash', 'aHash', 'dHash']), analytics)
        ) {
          similarWallpaper = existingWallpaper;
          similarWallpaperImageKit = get(existingWallpaper, ['imagekit']);
          return;
        }
      });
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
          imagekitUploadFile = await uploadToImagekit(wallpaperFilename, transfromFilenameToHashId(wallpaperFilename));
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
      console.log(`>>> [STAGE.4] >> 检测到相似图片（${similarWallpaper.filename}）...`);
      imagekit = similarWallpaperImageKit;
    }

    // 重命名此前的临时文件，转移至永久保存路径
    await fs.rename(thumbTmpImageFilePath, path.resolve(__dirname, '../../docs/thumbs/', `${imagekit.id}.jpg`));

    // [STAGE.5] >> 新建壁纸对象，并保存
    console.log(`>>> [STAGE.5] >> 新建壁纸对象，并保存...`);
    const wallpaper = new Wallpaper();
    wallpaper.date = get(wallpaperBingData, ['startdate']);
    wallpaper.title = get(wallpaperBingData, ['title']);
    wallpaper.lang = ((urlbase) => {
      if (/zh-cn/gi.test(urlbase)) {
        return langEnum['zh-CN'];
      } else if (/en-us/gi.test(urlbase)) {
        return langEnum['en-US'];
      }
    })(get(wallpaperBingData, ['urlbase']));
    wallpaper.filename = wallpaperFilename;
    wallpaper.copyright = get(wallpaperBingData, ['copyright']);
    wallpaper.copyrightlink = get(wallpaperBingData, ['copyrightlink']);
    wallpaper.quiz = get(wallpaperBingData, ['quiz']);

    wallpaper.analytics = analytics;
    wallpaper.imagekit = imagekit;

    nextWallpaper = await wallpaperRepository.save(wallpaper);
  } else {
    // * ----------------
    // * >>> 更新 <<<
    // * 更新壁纸的基本信息
    // * 以及检查是否有分析数据
    // * ----------------
    console.log(`
>> 更新 ${wallpaperFilename}...`);

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
    nextWallpaper = await wallpaperRepository.findOne(prevWallpaper.id, {
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
      isNil(get(nextWallpaper, ['analytics', 'dominantColor']))
    ) {
      // [STAGE.3-1] >> 下载缩率图
      console.log(`>>> [STAGE.3-1] >> 下载缩率图...`);
      const thumbImageWidth = 256;
      const thumbImageUrl = `https://cn.bing.com/th?id=${wallpaperFilename}_UHD.jpg&w=${thumbImageWidth}&c=1`;

      const thumbTmpImageFileName = transfromFilenameToHashId(wallpaperFilename);
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

      // [STAGE.3-2] >> 使用python分析下载的缩率图
      // 获取`aHash`、`dHash`、`wHash`、`pHash`、`dominantColor`数据
      console.log(`>>> [STAGE.3-2] >> 使用python分析下载的缩率图...`);
      let thumbImageAnalytics = null;
      let thumbImageAnalyticsRetryCount = 0;

      do {
        try {
          thumbImageAnalytics = await execPython('./src/getImageHash.py', thumbTmpImageFilePath);

          thumbImageAnalytics = JSON.parse(thumbImageAnalytics);
        } catch (error) {
          thumbImageAnalyticsRetryCount = thumbImageAnalyticsRetryCount + 1;
        }
      } while (thumbImageAnalytics === null && thumbImageAnalyticsRetryCount < 5);

      if (thumbImageAnalytics === null) {
        throw new Error(`addOrUpdateWallpaper: get analytics of image(${thumbImageUrl}) use python failed.`);
      }

      // [STAGE.3-3] >> 新建分析数据的对象，并保存上一阶段的分析结果
      console.log(`>>> [STAGE.3-3] >> 新建分析数据的对象，并保存上一阶段的分析结果...`);
      console.log(`>>> [STAGE.3-4] >> 更新分析数据的对象...`);
      await analyticsRepository.update(
        get(nextWallpaper, ['analytics', 'id']),
        pickBy(
          {
            aHash: thumbImageAnalytics.aHash,
            dHash: thumbImageAnalytics.dHash,
            wHash: thumbImageAnalytics.wHash,
            pHash: thumbImageAnalytics.pHash,
            dominantColor: thumbImageAnalytics.dominantColor,
          },
          identity,
        ),
      );

      // 依据壁纸`imagekit.id`，已经存在时，持久化存储缩略图，否则删除临时图片
      if (isString(get(nextWallpaper, ['imagekit', 'id']))) {
        // 重命名此前的临时文件，转移至永久保存路径
        await fs.rename(
          thumbTmpImageFilePath,
          path.resolve(__dirname, '../../docs/thumbs/', `${get(nextWallpaper, ['imagekit', 'id'])}.jpg`),
        );
      } else {
        // 删除临时文件
        await fs.rm(thumbTmpImageFilePath);
      }
    }
  }
  return nextWallpaper;
};
