import 'reflect-metadata';
import * as dotenv from 'dotenv';
// @ts-ignore
import * as ImageKit from 'imagekit';
import { isString } from 'lodash';

dotenv.config();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || '',
});

export default (
  wallpaperFileName: string,
  wallpaperId: string,
): Promise<{
  fileId: string;
  name: string;
  height: number;
  width: number;
}> =>
  new Promise((resolve, reject) => {
    if (isString(wallpaperFileName) === false || wallpaperFileName.length === 0) {
      reject(new Error('uploadToImagekit: must need wallpaper file name.'));
      return;
    }
    // imagekit SDK upload
    imagekit
      .upload({
        file: `https://cn.bing.com/th?id=${wallpaperFileName}_UHD.jpg&rf=LaDigue_UHD.jpg`,
        fileName: wallpaperId,
        folder: 'bing-wallpapers',
      })
      .then((imagekitFile) => {
        resolve(imagekitFile);
      })
      .catch((error) => {
        reject(error);
      });
  });
