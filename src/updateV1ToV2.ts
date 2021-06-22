import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { createConnection, Not, IsNull } from 'typeorm';
import { get, pick } from 'lodash';

import { Wallpaper as WallpaperV1 } from './models.v1/entities/Wallpaper';
import { Wallpaper } from './models/entities/Wallpaper';
import { Analytics } from './models/entities/Analytics';
import { Imagekit } from './models/entities/Imagekit';

import isSimilarImage from './utils/is-similar-image';

const main = async () => {
  console.log(`
==================================================
>> 连接壁纸数据数据库
--------------------------------------------------`);
  const databaseV1Connection = await createConnection('dbv1');
  const databaseV2Connection = await createConnection('dbv2');

  console.log(`>> 壁纸数据数据库连接成功`);

  const wallpaperV1Repository = databaseV1Connection.getRepository(WallpaperV1);
  const wallpaperV2Repository = databaseV2Connection.getRepository(Wallpaper);
  const analyticsV2Repository = databaseV2Connection.getRepository(Analytics);
  const imagekitV2Repository = databaseV2Connection.getRepository(Imagekit);

  const wallpapers = await wallpaperV1Repository.find({
    order: {
      date: 'DESC',
    },
    where: {
      hashImg: Not(IsNull()),
    },
  });
  console.log(`>> 当前共 ${wallpapers.length} 条数据`);

  for (const [wallpaperIndex, wallpaperInfo] of wallpapers.entries()) {
    console.log(
      `>>> 正在处理 【${wallpaperIndex + 1}/${wallpapers.length}】 条数据，文件名：${wallpaperInfo.filename}`,
    );
    // const thumbImageUrl = `https://cn.bing.com/th?id=${wallpaperInfo.filename}_UHD.jpg&w=256&c=1`;

    // const thumbImageFilePath = path.resolve(__dirname, '../docs/thumbs/', `${wallpaperInfo.id}.jpg`);

    // let thumbImageStat = null;
    // let thumbImageStatRetryCount = 0;

    // do {
    //   try {
    //     thumbImageStat = await downloadImage(thumbImageUrl, thumbImageFilePath);
    //   } catch (error) {
    //     thumbImageStatRetryCount = thumbImageStatRetryCount + 1;
    //   }
    // } while (thumbImageStat === null && thumbImageStatRetryCount < 5);

    // if (thumbImageStat === null) {
    //   // throw new Error('');
    //   console.error(`downloadImage: get ${thumbImageUrl} failed.`);
    //   break;
    // }

    // let thumbImageAnalytics = null;
    // let thumbImageAnalyticsRetryCount = 0;

    // do {
    //   try {
    //     thumbImageAnalytics = await execPython('./src/getImageHash.py', thumbImageFilePath);

    //     thumbImageAnalytics = JSON.parse(thumbImageAnalytics);
    //   } catch (error) {
    //     thumbImageAnalyticsRetryCount = thumbImageAnalyticsRetryCount + 1;
    //   }
    // } while (thumbImageAnalytics === null && thumbImageAnalyticsRetryCount < 5);

    // if (thumbImageAnalytics === null) {
    //   // throw new Error('');
    //   console.error(`getImageHash: analytic ${thumbImageUrl} failed.`);
    //   break;
    // }

    const analytics = new Analytics();

    analytics.aHash = wallpaperInfo.aHash;
    analytics.dHash = wallpaperInfo.dHash;
    analytics.wHash = wallpaperInfo.wHash;
    analytics.pHash = wallpaperInfo.pHash;
    analytics.dominantColor = wallpaperInfo.dominantColor;

    await analyticsV2Repository.save(analytics);

    const existingWallpapers = await wallpaperV2Repository.find({
      order: {
        date: 'DESC',
      },
      where: {
        analytics: Not(IsNull()),
      },
      relations: ['analytics', 'imagekit'],
    });

    let similarWallpaperImageKit = null;

    if (existingWallpapers.length > 0) {
      existingWallpapers.forEach((existingWallpaper) => {
        if (
          isSimilarImage(pick(get(existingWallpaper, ['analytics']), ['pHash', 'wHash', 'aHash', 'dHash']), analytics)
        ) {
          similarWallpaperImageKit = get(existingWallpaper, ['imagekit']);
          return;
        }
      });
    }

    const imagekit = similarWallpaperImageKit === null ? new Imagekit() : similarWallpaperImageKit;

    if (similarWallpaperImageKit === null) {
      imagekit.fileId = wallpaperInfo.imagekitFileId;
      imagekit.fileName = wallpaperInfo.imagekitFileName;
      imagekit.height = wallpaperInfo.imagekitFileHeight;
      imagekit.width = wallpaperInfo.imagekitFileWidth;
      await imagekitV2Repository.save(imagekit);

      const wallpaperThumbBase64 = wallpaperInfo.hashImg;
      const wallpaperThumbFileType = wallpaperThumbBase64.match(/^data\:image\/(\w+)\;base64\,/i)[1];

      const thumbImageFilePath = path.resolve(__dirname, '../docs/thumbs/', `${imagekit.id}.${wallpaperThumbFileType}`);
      fs.writeFileSync(thumbImageFilePath, wallpaperThumbBase64.replace(/^data\:image\/\w+\;base64\,/i, ''), 'base64');
    }

    const wallpaper = new Wallpaper();

    wallpaper.date = wallpaperInfo.date;
    wallpaper.title = wallpaperInfo.title;
    // 0 >> zh-CN
    // 1 >> en-US
    // 2 >>
    wallpaper.lang = /zh(\-|\_)cn/gi.test(wallpaperInfo.filename) ? 0 : 1;

    wallpaper.filename = wallpaperInfo.filename;
    wallpaper.copyright = wallpaperInfo.copyright;

    wallpaper.analytics = analytics;
    wallpaper.imagekit = imagekit;

    await wallpaperV2Repository.save(wallpaper);

    //     const newWallpaper = merge(
    //       new Wallpaper(),
    //       {
    //         filename: get(wallpaperInfo, ['filename']),
    //         hsh: get(wallpaperInfo, ['id'], crypto.createHash('md5').update(`${get(wallpaperInfo, ['filename'])}_${get(wallpaperInfo, ['date'])}`).digest('hex')),
    //         copyright: ${get(wallpaperInfo, ['filename'])}
    // copyrightlink
    // quiz
    // lang
    // date
    //         filename,
    //         id,
    //         title: get(wallpaper, ['title']),
    //         description,
    //         address,
    //         copyright,
    //         lang: ((urlbase) => {
    //           if (/zh-cn/gi.test(urlbase)) {
    //             return langEnum['zh-CN'];
    //           } else if (/en-us/gi.test(urlbase)) {
    //             return langEnum['en-US'];
    //           }
    //         })(get(wallpaper, ['urlbase'])),
    //         date: isUpdate ? get(wallpaper, ['date']) : get(wallpaper, ['startdate']),
    //         responseTxt: isUpdate
    //           ? get(wallpaper, ['responseTxt'])
    //           : Buffer.from(get(wallpaper, ['copyright']), 'utf8').toString('base64'),
    //       },
    //       pick(wallpaper, ['imagekitFileId', 'imagekitFileName', 'imagekitFileHeight', 'imagekitFileWidth']),
    //     );
  }
};

(async () => {
  await main();
})();
