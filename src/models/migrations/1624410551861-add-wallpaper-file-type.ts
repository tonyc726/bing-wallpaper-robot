import {MigrationInterface, QueryRunner} from "typeorm";

export class addWallpaperFileType1624410551861 implements MigrationInterface {
    name = 'addWallpaperFileType1624410551861'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "temporary_analytics" (
                "id" varchar PRIMARY KEY NOT NULL,
                "aHash" text,
                "pHash" text,
                "dHash" text,
                "wHash" text,
                "dominantColor" text
            )
        `);
        await queryRunner.query(`
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
        `);
        await queryRunner.query(`
            DROP TABLE "analytics"
        `);
        await queryRunner.query(`
            ALTER TABLE "temporary_analytics"
                RENAME TO "analytics"
        `);
        await queryRunner.query(`
            CREATE TABLE "temporary_wallpaper" (
                "id" varchar PRIMARY KEY NOT NULL,
                "filename" text(200) NOT NULL,
                "date" date NOT NULL,
                "title" text,
                "copyright" text,
                "copyrightlink" text,
                "quiz" text,
                "lang" tinyint NOT NULL,
                "analyticsId" varchar,
                "imagekitId" varchar,
                "ext" text(50),
                "mime" text(100),
                CONSTRAINT "REL_a1fe93dd602b7e51187a9d1b5e" UNIQUE ("analyticsId"),
                CONSTRAINT "FK_47d80c2c24dcaedf403316ae903" FOREIGN KEY ("imagekitId") REFERENCES "imagekit" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
                CONSTRAINT "FK_a1fe93dd602b7e51187a9d1b5e7" FOREIGN KEY ("analyticsId") REFERENCES "analytics" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            INSERT INTO "temporary_wallpaper"(
                    "id",
                    "filename",
                    "date",
                    "title",
                    "copyright",
                    "copyrightlink",
                    "quiz",
                    "lang",
                    "analyticsId",
                    "imagekitId"
                )
            SELECT "id",
                "filename",
                "date",
                "title",
                "copyright",
                "copyrightlink",
                "quiz",
                "lang",
                "analyticsId",
                "imagekitId"
            FROM "wallpaper"
        `);
        await queryRunner.query(`
            DROP TABLE "wallpaper"
        `);
        await queryRunner.query(`
            ALTER TABLE "temporary_wallpaper"
                RENAME TO "wallpaper"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "wallpaper"
                RENAME TO "temporary_wallpaper"
        `);
        await queryRunner.query(`
            CREATE TABLE "wallpaper" (
                "id" varchar PRIMARY KEY NOT NULL,
                "filename" text(200) NOT NULL,
                "date" date NOT NULL,
                "title" text,
                "copyright" text,
                "copyrightlink" text,
                "quiz" text,
                "lang" tinyint NOT NULL,
                "analyticsId" varchar,
                "imagekitId" varchar,
                CONSTRAINT "REL_a1fe93dd602b7e51187a9d1b5e" UNIQUE ("analyticsId"),
                CONSTRAINT "FK_47d80c2c24dcaedf403316ae903" FOREIGN KEY ("imagekitId") REFERENCES "imagekit" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
                CONSTRAINT "FK_a1fe93dd602b7e51187a9d1b5e7" FOREIGN KEY ("analyticsId") REFERENCES "analytics" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            INSERT INTO "wallpaper"(
                    "id",
                    "filename",
                    "date",
                    "title",
                    "copyright",
                    "copyrightlink",
                    "quiz",
                    "lang",
                    "analyticsId",
                    "imagekitId"
                )
            SELECT "id",
                "filename",
                "date",
                "title",
                "copyright",
                "copyrightlink",
                "quiz",
                "lang",
                "analyticsId",
                "imagekitId"
            FROM "temporary_wallpaper"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_wallpaper"
        `);
        await queryRunner.query(`
            ALTER TABLE "analytics"
                RENAME TO "temporary_analytics"
        `);
        await queryRunner.query(`
            CREATE TABLE "analytics" (
                "id" varchar PRIMARY KEY NOT NULL,
                "hashImg" text,
                "aHash" text,
                "pHash" text,
                "dHash" text,
                "wHash" text,
                "dominantColor" text
            )
        `);
        await queryRunner.query(`
            INSERT INTO "analytics"(
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
            FROM "temporary_analytics"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_analytics"
        `);
    }

}
