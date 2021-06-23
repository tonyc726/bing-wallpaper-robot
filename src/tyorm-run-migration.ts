import 'reflect-metadata';
import { createConnection } from 'typeorm';

(async () => {
  const databaseConnection = await createConnection();
  await databaseConnection.query('PRAGMA foreign_keys=OFF;');
  await databaseConnection.runMigrations();
  await databaseConnection.query('PRAGMA foreign_keys=ON;');
})();
