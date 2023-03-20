import 'reflect-metadata';
import * as fs from 'fs';
import * as pfs from 'fs/promises';
import * as path from 'path';
import * as FileType from 'file-type';
import { isEmpty, isNil, get, pickBy, identity, isString, isNumber } from 'lodash';

import { createConnection } from 'typeorm';
import { Wallpaper } from './models';

// import transfromFilenameToHashId from './utils/transfrom-filename-to-hash-id';
// import execPython from './utils/exec-python';

(async () => {
  const databaseConnection = await createConnection();
  const wallpaperRepository = databaseConnection.getRepository(Wallpaper);

  const allWallpapers = await wallpaperRepository.find();

  let tmp = allWallpapers.filter(
    ({ filename }) => isNil(filename) === true || filename.length === 0,
  );

  let dateInvaildWallpapers = allWallpapers.filter(
    // ({ date }) => /(\d{4})(\d{2})(\d{2})/.test(date) === false,
    ({ date }) => isNumber(date) === false,
  );


  for (const dateInvaildWallpaper of dateInvaildWallpapers) {
    dateInvaildWallpaper.date = dateInvaildWallpaper.date.replace(',', '');
    console.log(dateInvaildWallpaper)
    wallpaperRepository.save(dateInvaildWallpaper);
  }



  // const thumbImageAnalytics = await execPython(
  //   './src/getImageHash.py',
  //   path.resolve(__dirname, '../docs/thumbs', 'a8141fdf82a086ba2960de9718e53558.jpg'),
  // );

  // const x = JSON.parse(thumbImageAnalytics);

  console.log(tmp);
})();
