import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { createConnection, IsNull, Not } from 'typeorm';
import * as ImageKit from 'imagekit';

import { Wallpaper } from './models/entities/Wallpaper';
import saveWallpaper from './utils/save-wallpaper';

dotenv.config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const main = async () => {
  console.log(`
==================================================
>> 即将开始 imagekit.io 上传程序
--------------------------------------------------`);
  const databaseConnection = await createConnection();
  const wallpaperRepository = databaseConnection.getRepository(Wallpaper);
  const wallpapers = await wallpaperRepository.find({
    order: {
      date: 'DESC',
    },
    where: {
      hashImg: Not(IsNull()),
      imagekitFileName: IsNull(),
    },
  });

  console.log(`>> 本次共需上传 ${wallpapers.length} 张壁纸`);

  for (const [i, wallpaper] of wallpapers.entries()) {
    console.log(`>>> [${i + 1}/${wallpapers.length}] 正在处理 ${wallpaper.filename}`);
    const wallpaperUrl = `https://cn.bing.com/th?id=${wallpaper.filename}_UHD.jpg&rf=LaDigue_UHD.jpg`;
    try {
      const uploadResult = await imagekit.upload({
        file: wallpaperUrl,
        fileName: wallpaper.id,
        folder: 'bing-wallpapers',
      });
      const nextWallpaper = {
        ...wallpaper,
        imagekitFileId: uploadResult.fileId,
        imagekitFileName: uploadResult.name,
        imagekitFileHeight: uploadResult.height,
        imagekitFileWidth: uploadResult.width,
      };
      await saveWallpaper(wallpaperRepository, nextWallpaper, true);
    } catch (error) {
      console.error(error);
    }
  }

  console.log(`--------------------------------------------------
>> 全部处理完毕！
>> 数据入库完成，正在关闭数据库！`);
  await databaseConnection.close();
  console.log(`>> 数据库已经关闭！
==================================================
  `);
};

(async () => {
  await main();
})();
