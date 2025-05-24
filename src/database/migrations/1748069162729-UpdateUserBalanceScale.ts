import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateUserBalanceScale1748069162729 implements MigrationInterface {
    name = 'UpdateUserBalanceScale1748069162729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "balance" TYPE numeric(18,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "balance" TYPE numeric(18,4)`);
    }

}
