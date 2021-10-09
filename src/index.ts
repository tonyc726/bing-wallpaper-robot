import * as githubActionCore from '@actions/core';
import 'reflect-metadata';
import { createConnection, In } from 'typeorm';
import { format } from 'date-fns';

import { Wallpaper } from './models/entities/Wallpaper';
import { Analytics } from './models/entities/Analytics';
import { Imagekit } from './models/entities/Imagekit';
import makeRandomNumber from './utils/make-random-number';
import getMultipleBingWallpaperInfo from './utils/get-multiple-bing-wallpaper-info';
import transformFilenameFromUrlbase from './utils/transform-filename-from-urlbase';
import addOrUpdateWallpaper from './utils/add-or-update-wallpaper';

const getMultipleBingWallpaperInfoWithRetry = async (maxRetryTime = 5) => {
  let result = null;
  try {
    result = await getMultipleBingWallpaperInfo();
  } catch (e) {
    if (maxRetryTime >= 0) {
      result = await getMultipleBingWallpaperInfoWithRetry(maxRetryTime - 1)
    }
  }
  return result;
}

const main = async (retry = 1) => {
  console.log(`
==================================================
>> 第 ${retry} 次更新 Bing 壁纸数据
--------------------------------------------------`);
  let bingWallpapersData = [];
  try {
    bingWallpapersData = await getMultipleBingWallpaperInfoWithRetry();
  } catch (error) {
    console.log(`>> 数据请求失败
==================================================
  `);
    return;
  }

  if (Array.isArray(bingWallpapersData) && bingWallpapersData.length !== 0) {
    console.log(`>> 本次共获取 ${bingWallpapersData.length} 条Bing壁纸数据`);
    const databaseConnection = await createConnection();
    const wallpaperRepository = databaseConnection.getRepository(Wallpaper);
    const analyticsRepository = databaseConnection.getRepository(Analytics);
    const imagekitRepository = databaseConnection.getRepository(Imagekit);
    console.log(`>> 数据库连接成功`);

    const beforeUpdateDataCount = await wallpaperRepository.count();
    const waitToUpdateDataCount = await wallpaperRepository.count({
      filename: In(bingWallpapersData.map((wallpaperData) => transformFilenameFromUrlbase(wallpaperData.urlbase))),
    });

    console.log(`>> 当前数据库现有 ${beforeUpdateDataCount} 条数据！
>> 本次待新增 ${bingWallpapersData.length - waitToUpdateDataCount} 条，待更新 ${waitToUpdateDataCount} 条！
--------------------------------------------------`);

    for await (const bingWallpaperData of bingWallpapersData) {
      try {
        const wallpaper = await addOrUpdateWallpaper(bingWallpaperData, {
          wallpaper: wallpaperRepository,
          analytics: analyticsRepository,
          imagekit: imagekitRepository,
        });
        console.log(`>> [${wallpaper.id}] ${wallpaper.filename} 写入成功！`);
      } catch (error) {
        console.log(error);
        console.log(`>> [Error] ${transformFilenameFromUrlbase(bingWallpaperData.urlbase)} 写入失败！`);
      }
    }

    const afterUpdateDataCount = await wallpaperRepository.count();

    console.log(`--------------------------------------------------
>> 更新后，数据库有 ${afterUpdateDataCount} 条数据！
>> 数据入库完成，正在关闭数据库！`);
    await databaseConnection.close();

    console.log(`>> 数据库已经关闭！
==================================================
  `);
    githubActionCore.setOutput(
      'COMMIT_MESSAGE',
      `:robot: >> [${format(new Date(), 'dd/MM/yyyy')}] ADD ${
        bingWallpapersData.length - waitToUpdateDataCount
      }, UPDATE ${waitToUpdateDataCount}.`,
    );
  }
};

(async () => {
  await main();
})();
