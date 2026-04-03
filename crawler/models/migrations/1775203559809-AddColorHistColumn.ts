import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColorHistColumn1775203559809 implements MigrationInterface {
    name = 'AddColorHistColumn1775203559809'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "temporary_analytics" ("id" varchar PRIMARY KEY NOT NULL, "aHash" text, "pHash" text, "dHash" text, "wHash" text, "dominantColor" text, "colorHist" text)`);
        await queryRunner.query(`INSERT INTO "temporary_analytics"("id", "aHash", "pHash", "dHash", "wHash", "dominantColor") SELECT "id", "aHash", "pHash", "dHash", "wHash", "dominantColor" FROM "analytics"`);
        await queryRunner.query(`DROP TABLE "analytics"`);
        await queryRunner.query(`ALTER TABLE "temporary_analytics" RENAME TO "analytics"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "analytics" RENAME TO "temporary_analytics"`);
        await queryRunner.query(`CREATE TABLE "analytics" ("id" varchar PRIMARY KEY NOT NULL, "aHash" text, "pHash" text, "dHash" text, "wHash" text, "dominantColor" text)`);
        await queryRunner.query(`INSERT INTO "analytics"("id", "aHash", "pHash", "dHash", "wHash", "dominantColor") SELECT "id", "aHash", "pHash", "dHash", "wHash", "dominantColor" FROM "temporary_analytics"`);
        await queryRunner.query(`DROP TABLE "temporary_analytics"`);
    }

}
