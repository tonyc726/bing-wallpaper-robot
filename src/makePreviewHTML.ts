import 'reflect-metadata';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { createConnection, IsNull, Not } from 'typeorm';
import * as ejs from 'ejs';
import * as htmlMinify from 'html-minifier';
import { map, pick, get } from 'lodash';

const writeFile = util.promisify(fs.writeFile);

import { Wallpaper } from './models/entities/Wallpaper';

const main = async (retry = 1) => {
  const databaseConnection = await createConnection();
  const wallpaperRepository = databaseConnection.getRepository(Wallpaper);
  const wallpapers = await wallpaperRepository.find({
    order: {
      date: 'DESC',
    },
    where: {
      hashImg: Not(IsNull()),
    },
  });

  const previewHTML = await ejs
    .renderFile(
      path.resolve(__dirname, './index.ejs'),
      {
        wallpapers: map(wallpapers, (wallpaper) => ({
          ...pick(wallpaper, [
            'description',
            'date',
            'filename',
            'dominantColor',
            'imagekitFileHeight',
            'imagekitFileWidth',
          ]),
          width: 600,
          height: Math.ceil((600 * get(wallpaper, ['imagekitFileHeight'])) / get(wallpaper, ['imagekitFileWidth'])),
        })),
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
    collapseWhitespace: true
  });

  writeFile(path.resolve(__dirname, '../docs/index.html'), previewHTMLMini);
};

(async () => {
  await main();
})();
