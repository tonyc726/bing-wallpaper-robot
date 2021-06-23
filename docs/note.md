# 项目笔记

> 记录一些项目中遇到的问题 以及 操作记录

## [2021/06/23] - 直接使用`npm run migration:run`时，遇到 SQLite3 报错

概要信息如下：

```bash
QueryFailedError: SQLITE_CONSTRAINT: FOREIGN KEY constraint failed
```

详细错误信息如下：

```bash
query: SELECT * FROM "sqlite_master" WHERE "type" = 'table' AND "name" = 'migrations'
query: CREATE TABLE "migrations" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "timestamp" bigint NOT NULL, "name" varchar NOT NULL)
query: SELECT * FROM "migrations" "migrations" ORDER BY "id" DESC
0 migrations are already loaded in the database.
1 migrations were found in the source code.
1 migrations are new migrations that needs to be executed.
query: BEGIN TRANSACTION
query:
            CREATE TABLE "temporary_analytics" (
                "id" varchar PRIMARY KEY NOT NULL,
                "aHash" text,
                "pHash" text,
                "dHash" text,
                "wHash" text,
                "dominantColor" text
            )

query:
            INSERT INTO "temporary_analytics"(
                    "id",
                    "aHash",
                    "pHash",
                    "dHash",
                    "wHash",
                    "dominantColor"
                )
            SELECT "id",
                "aHash",
                "pHash",
                "dHash",
                "wHash",
                "dominantColor"
            FROM "analytics"

query:
            DROP TABLE "analytics"

query failed:
            DROP TABLE "analytics"

error: Error: SQLITE_CONSTRAINT: FOREIGN KEY constraint failed
--> in Database#all('\n            DROP TABLE "analytics"\n        ', undefined, [Function: handler])
    at SqliteQueryRunner.<anonymous> ({PROJECT_PATH}\bing-wallpaper-robot\src\driver\sqlite\SqliteQueryRunner.ts:58:40)
    at step ({PROJECT_PATH}\bing-wallpaper-robot\node_modules\typeorm\node_modules\tslib\tslib.js:143:27)
    at Object.next ({PROJECT_PATH}\bing-wallpaper-robot\node_modules\typeorm\node_modules\tslib\tslib.js:124:57)
    at {PROJECT_PATH}\bing-wallpaper-robot\node_modules\typeorm\node_modules\tslib\tslib.js:117:75
    at new Promise (<anonymous>)
    at Object.__awaiter ({PROJECT_PATH}\bing-wallpaper-robot\node_modules\typeorm\node_modules\tslib\tslib.js:113:16)
    at execute ({PROJECT_PATH}\bing-wallpaper-robot\src\driver\sqlite\SqliteQueryRunner.ts:54:29)
    at SqliteQueryRunner.<anonymous> ({PROJECT_PATH}\bing-wallpaper-robot\src\driver\sqlite\SqliteQueryRunner.ts:85:19)
    at step ({PROJECT_PATH}\bing-wallpaper-robot\node_modules\typeorm\node_modules\tslib\tslib.js:143:27) {
  errno: 19,
  code: 'SQLITE_CONSTRAINT',
  __augmented: true
}
query: ROLLBACK
Error during migration run:
QueryFailedError: SQLITE_CONSTRAINT: FOREIGN KEY constraint failed
    at new QueryFailedError ({PROJECT_PATH}\bing-wallpaper-robot\src\error\QueryFailedError.ts:11:9)
    at Statement.handler ({PROJECT_PATH}\bing-wallpaper-robot\src\driver\sqlite\SqliteQueryRunner.ts:79:26)
    at Statement.replacement ({PROJECT_PATH}\bing-wallpaper-robot\node_modules\sqlite3\lib\trace.js:25:27) {
  errno: 19,
  code: 'SQLITE_CONSTRAINT',
  __augmented: true,
  query: '\n            DROP TABLE "analytics"\n        ',
  parameters: []
}
```

### 解决方案

[With TypeORM, `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed` when adding a column to an entity - stackoverflow](https://stackoverflow.com/questions/60591696/with-typeorm-sqlite-constraint-foreign-key-constraint-failed-when-adding-a-c)

> 提醒：`ormconfig.json`文件中的`synchronize`务必设置为`false`

直接使用脚本执行`migration:run`操作：

```typescript
import 'reflect-metadata';
import { createConnection } from 'typeorm';

(async () => {
  const databaseConnection = await createConnection();
  await databaseConnection.query('PRAGMA foreign_keys=OFF;');
  await databaseConnection.runMigrations();
  await databaseConnection.query('PRAGMA foreign_keys=ON;');
})();
```
