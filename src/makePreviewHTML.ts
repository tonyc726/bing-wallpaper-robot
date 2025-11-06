import 'reflect-metadata';
import 'sqlite3';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import * as htmlMinify from 'html-minifier';
import { map, get, find, filter, sortBy, isEmpty, isString, reduce } from 'lodash';
import { formatISO, format } from 'date-fns';

const writeFile = util.promisify(fs.writeFile);

import AppDataSource from './database';
import { Imagekit } from './models';

const main = async () => {
  await AppDataSource.initialize();
  const imagekitRepository = AppDataSource.getRepository(Imagekit);

  const imagekits = await imagekitRepository.find({
    order: {
      id: 'DESC',
    },
    relations: ['wallpapers', 'wallpapers.analytics'],
  });

  const cleanWallpapers = sortBy(
    filter(
      map(imagekits, (imagekit) => {
        // const thumbImageSrc = `./thumbs/${imagekit.id}.`
        const wallpapers = imagekit.wallpapers;
        // 0 >> zh-cn
        // 1 >> en-us
        const zhCNData = find(wallpapers, (w) => w.lang === 0);
        const enUSData = find(wallpapers, (w) => w.lang === 1);
        const wallpaperDate = get(zhCNData, ['date'], get(enUSData, ['date']));

        return {
          filename: get(zhCNData, ['filename'], get(enUSData, ['filename'])),
          description: get(zhCNData, ['description'], get(enUSData, ['description'])),
          date: wallpaperDate,
          dateFmt: `${wallpaperDate}`.replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3'),
          title: get(zhCNData, ['title'], get(enUSData, ['title'])),
          copyright: get(zhCNData, ['copyright'], get(enUSData, ['copyright'])),
          dominantColor: get(zhCNData, ['analytics', 'dominantColor'], get(enUSData, ['analytics', 'dominantColor'])),
          imagekitFileHeight: imagekit.height!,
          imagekitFileWidth: imagekit.width!,
          width: 600,
          height: Math.ceil((600 * (imagekit.height || 0)) / (imagekit.width || 1)),
        };
      }),
      (wallpaper) => isEmpty(wallpaper) === false && isString(wallpaper.filename) && wallpaper.filename.length !== 0,
    ),
    [(a: any) => -a.date],
  );
  const cleanWallpapersCount = cleanWallpapers.length;
  const wallpapersGroupData = reduce(
    cleanWallpapers,
    (wallpapersReduce: any[], wallpaper: any) => {
      const wallpaperGroupMonth = format(new Date(wallpaper.dateFmt), 'yyyy-MM');
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

  const previewHTML = await ejs
    .renderFile(
      path.resolve(__dirname, './index.ejs'),
      {
        wallpapersCount: cleanWallpapersCount,
        wallpapersGroupData: wallpapersGroupData,
        lastModifiedDate: formatISO(new Date()),
        copyrightYear: `2017-${format(new Date(), 'yyyy')}`,
      },
      {
        rmWhitespace: true,
      },
    )
    .then((output) => output);

  const previewHTMLMini = htmlMinify.minify(previewHTML, {
    minifyCSS: true,
    minifyJS: true,
    minifyURLs: true,
    removeComments: true,
    collapseWhitespace: true,
  });

  await writeFile(path.resolve(__dirname, '../docs/index.html'), previewHTMLMini);
};

(async () => {
  await main();
})();
