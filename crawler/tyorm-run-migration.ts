import 'reflect-metadata';
import 'sqlite3';

import AppDataSource from './database';

(async () => {
  await AppDataSource.initialize();
  await AppDataSource.query('PRAGMA foreign_keys=OFF;');
  await AppDataSource.runMigrations();
  await AppDataSource.query('PRAGMA foreign_keys=ON;');
})();
