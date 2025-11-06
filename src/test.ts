import 'reflect-metadata';
import 'sqlite3';
import { isNil, isNumber } from 'lodash';

import AppDataSource from './database';
import { Wallpaper } from './models';

// import transfromFilenameToHashId from './utils/transfrom-filename-to-hash-id';
// import execPython from './utils/exec-python';

(async () => {
  await AppDataSource.initialize();
  const wallpaperRepository = AppDataSource.getRepository(Wallpaper);

  const allWallpapers = await wallpaperRepository.find();

  let tmp = allWallpapers.filter(({ filename }) => isNil(filename) === true || filename.length === 0);

  let dateInvaildWallpapers = allWallpapers.filter(
    // ({ date }) => /(\d{4})(\d{2})(\d{2})/.test(date) === false,
    ({ date }) => isNumber(date) === false,
  );

  for (const dateInvaildWallpaper of dateInvaildWallpapers) {
    dateInvaildWallpaper.date = dateInvaildWallpaper.date.replace(',', '');
    console.log(dateInvaildWallpaper);
    wallpaperRepository.save(dateInvaildWallpaper);
  }

  // const thumbImageAnalytics = await execPython(
  //   './src/getImageHash.py',
  //   path.resolve(__dirname, '../docs/thumbs', 'a8141fdf82a086ba2960de9718e53558.jpg'),
  // );

  // const x = JSON.parse(thumbImageAnalytics);

  console.log(tmp);
})();
