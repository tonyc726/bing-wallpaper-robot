import 'reflect-metadata';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { createConnection } from 'typeorm';
import * as ejs from 'ejs';
import * as htmlMinify from 'html-minifier';
import { map, get, find, filter, sortBy, isEmpty, isString } from 'lodash';
import { formatISO } from 'date-fns';

const writeFile = util.promisify(fs.writeFile);

import { Imagekit } from './models';

const main = async (retry = 1) => {
  const databaseConnection = await createConnection();
  const imagekitRepository = databaseConnection.getRepository(Imagekit);

  const imagekits = await imagekitRepository.find({
    order: {
      id: 'DESC',
    },
    relations: ['wallpapers', 'wallpapers.analytics'],
  });

  const previewHTML = await ejs
    .renderFile(
      path.resolve(__dirname, './index.ejs'),
      {
        wallpapers: sortBy(
          filter(map(imagekits, (imagekit) => {
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
              dominantColor: get(
                zhCNData,
                ['analytics', 'dominantColor'],
                get(enUSData, ['analytics', 'dominantColor']),
              ),
              imagekitFileHeight: imagekit.height,
              imagekitFileWidth: imagekit.width,
              width: 600,
              height: Math.ceil((600 * imagekit.height) / imagekit.width),
            };
          }), (wallpaper) => (
            isEmpty(wallpaper) === false &&
            (
              isString(wallpaper.filename) && wallpaper.filename.length !== 0
            )
          )),
          [(a) => -a.date],
        ),
        lastModifiedDate: formatISO(new Date()),
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
