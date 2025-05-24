import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTransactionsScale1748070391720 implements MigrationInterface {
    name = 'UpdateTransactionsScale1748070391720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "price_at_transaction" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "total_amount" TYPE numeric(18,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "total_amount" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "price_at_transaction" TYPE numeric(18,4)`);
    }

}
