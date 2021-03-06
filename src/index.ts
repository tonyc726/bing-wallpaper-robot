import * as githubActionCore from '@actions/core';
import 'reflect-metadata';
import { createConnection, In } from 'typeorm';
import { isEmpty } from 'lodash';
import { format } from 'date-fns';

import { Wallpaper } from './models/entities/Wallpaper';
import { Analytics } from './models/entities/Analytics';
import { Imagekit } from './models/entities/Imagekit';
import makeRandomNumber from './utils/make-random-number';
import getMultipleBingWallpaperInfo from './utils/get-multiple-bing-wallpaper-info';
import transfromFilenameFromUrlbase from './utils/transfrom-filename-from-urlbase';
import addOrUpdateWallpaper from './utils/add-or-update-wallpaper';

const main = async (retry = 1) => {
  console.log(`
==================================================
>> 第 ${retry} 次获取Bing壁纸数据
--------------------------------------------------`);
  let bingWallpapersData = null;
  try {
    const getMultipleBingWallpaperInfoResult = await getMultipleBingWallpaperInfo();
    bingWallpapersData = getMultipleBingWallpaperInfoResult;
  } catch (error) {
    console.log(`>> 数据请求失败
==================================================
  `);
    if (retry <= 5) {
      // 如果请求失败，延时再试，最多5次
      setTimeout(async () => {
        await main(retry + 1);
      }, makeRandomNumber(500, 5000));
    }
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
      filename: In(bingWallpapersData.map((wallpaperData) => transfromFilenameFromUrlbase(wallpaperData.urlbase))),
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
        console.log(`>> [Error] ${transfromFilenameFromUrlbase(bingWallpaperData.urlbase)} 写入失败！`);
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
