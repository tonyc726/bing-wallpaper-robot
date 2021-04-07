import {MigrationInterface, QueryRunner} from "typeorm";

export class WallpaperRefactoring1616939053087 implements MigrationInterface {
    name = 'WallpaperRefactoring1616939053087'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "temporary_wallpaper" (
                "id" text(50) PRIMARY KEY NOT NULL,
                "filename" text(200) NOT NULL,
                "title" text,
                "description" text,
                "copyright" text,
                "lang" tinyint NOT NULL,
                "date" date NOT NULL,
                "address" text,
                "responseTxt" text,
                "imagekitFileId" text,
                "imagekitFileName" text,
                "imagekitFileHeight" integer,
                "imagekitFileWeight" integer,
                "aHash" text,
                "pHash" text,
                "dHash" text,
                "wHash" text
            )
        `);
        await queryRunner.query(`
            INSERT INTO "temporary_wallpaper"(
                    "id",
                    "filename",
                    "title",
                    "description",
                    "copyright",
                    "lang",
                    "date",
                    "address",
                    "responseTxt"
                )
            SELECT "id",
                "filename",
                "title",
                "description",
                "copyright",
                "lang",
                "date",
                "address",
                "responseTxt"
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
                "id" text(50) PRIMARY KEY NOT NULL,
                "filename" text(200) NOT NULL,
                "title" text,
                "description" text,
                "copyright" text,
                "lang" tinyint NOT NULL,
                "date" date NOT NULL,
                "address" text,
                "responseTxt" text
            )
        `);
        await queryRunner.query(`
            INSERT INTO "wallpaper"(
                    "id",
                    "filename",
                    "title",
                    "description",
                    "copyright",
                    "lang",
                    "date",
                    "address",
                    "responseTxt"
                )
            SELECT "id",
                "filename",
                "title",
                "description",
                "copyright",
                "lang",
                "date",
                "address",
                "responseTxt"
            FROM "temporary_wallpaper"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_wallpaper"
        `);
    }

}
