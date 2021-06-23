# 升级日志

## [2021/06/23] 处理缩略图图片类型及数据

- feat: 增加`Wallpaper`模型中的`ext`与`mime`数据；
- feat: 去除`Analytics`模型中的`hashImg`数据；

核心升级脚本:

```typescript
import 'reflect-metadata';
import * as fs from 'fs';
import * as pfs from 'fs/promises';
import * as path from 'path';
import * as FileType from 'file-type';
import { isEmpty, isNil, get, pickBy, identity } from 'lodash';

import { createConnection } from 'typeorm';
import { Wallpaper } from './models';

(async () => {
  const databaseConnection = await createConnection();
  const wallpaperRepository = databaseConnection.getRepository(Wallpaper);

  const thumbFilesDirPath = path.resolve(__dirname, '../docs/thumbs');
  const thumbFiles = await pfs.readdir(thumbFilesDirPath);

  console.log(`> 当前共有 ${thumbFiles.length} 张缩略图...`);

  for await (const [thumbFileIndex, thumbFileName] of thumbFiles.entries()) {
    console.log(`> [${thumbFileIndex + 1}/${thumbFiles.length}] 正在处理 ${thumbFileName}`);
    const thumbFilePath = path.resolve(thumbFilesDirPath, thumbFileName);
    const thumbFileReadStream = fs.createReadStream(thumbFilePath);
    const thumbFileType = await FileType.fromStream(thumbFileReadStream);

    if (isEmpty(thumbFileType) || isNil(get(thumbFileType, ['ext'])) || isNil(get(thumbFileType, ['mime']))) {
      console.log(`>> [ERROR] 识别 ${thumbFileName} 文件类型数据失败`);
      return;
    }

    const wallpapers = await wallpaperRepository.find({
      where: {
        imagekit: {
          id: thumbFileName.replace(/(\w+)\..*/gi, '$1'),
        },
      },
      // relations: ['analytics', 'imagekit'],
    });

    if (wallpapers?.length === 0) {
      console.log(`>> 未检测到与 ${thumbFileName} 相关的"wallpaper"数据，删除该缩略图`);
      await pfs.rm(thumbFilePath);
    } else {
      console.log(`>> 共检测到与 ${thumbFileName} 相关的"wallpaper"数据 ${wallpapers.length} 条.`);
      for await (const wallpaper of wallpapers) {
        console.log(`>>> 正在更新 ${wallpaper.filename} 的数据`);
        await wallpaperRepository.update(
          wallpaper.id,
          pickBy(
            {
              ext: get(thumbFileType, ['ext']),
              mime: get(thumbFileType, ['mime']),
            },
            identity,
          ),
        );
      }
      const nextThumbFileName = thumbFileName.replace(/(\w+)\..*/gi, `$1.${get(thumbFileType, ['ext'])}`);
      if (thumbFileName !== nextThumbFileName) {
        console.log(`>> 正在更名 ${thumbFileName} 为 ${nextThumbFileName}`);
        await pfs.rename(thumbFilePath, path.resolve(thumbFilesDirPath, nextThumbFileName));
      }
    }
  }
})();
```

## [2021/06/19] 重构数据结构，升级至 **V2** 版本

> https://github.com/tonyc726/bing-wallpaper-robot/commit/7561c8d30b3f19c4f959309ec0e3a7048f91b958

- refactor: 分离`Wallpaper`、`Analytics`、`Imagekit`数据库模型结构；
- feat: 增加使用汉明距离计算图片相似度后去重的功能；
- feat: 在`docs/thumbs`中保存缩略图的功能;
- refactor: 重构爬取脚本；

核心升级脚本:

```typescript
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

(async () => {
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
  }
})();
```
