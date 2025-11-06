import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Wallpaper } from './models/entities/Wallpaper';
import { Analytics } from './models/entities/Analytics';
import { Imagekit } from './models/entities/Imagekit';

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database/bing-wallpaper.sqlite',
  synchronize: false,
  logging: false,
  entities: [Wallpaper, Analytics, Imagekit],
  migrations: ['src/models/migrations/**/*.ts'],
  subscribers: ['src/models/subscribers/**/*.ts'],
});

export default AppDataSource;
