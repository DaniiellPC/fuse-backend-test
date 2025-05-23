import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1747981026601 implements MigrationInterface {
    name = 'InitialSchema1747981026601'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum" AS ENUM('BUY', 'SELL')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "stock_symbol" character varying(10) NOT NULL, "transaction_type" "public"."transactions_transaction_type_enum" NOT NULL, "quantity" integer NOT NULL, "price_at_transaction" numeric(18,4) NOT NULL, "total_amount" numeric(18,4) NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'PENDING', "transaction_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completion_date" TIMESTAMP WITH TIME ZONE, "message" character varying(500), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "portfolios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "stock_symbol" character varying(10) NOT NULL, "quantity" integer NOT NULL, "average_buy_price" numeric(18,4), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_980dc8712c8efbb5db3fee23f36" UNIQUE ("user_id", "stock_symbol"), CONSTRAINT "PK_488aa6e9b219d1d9087126871ae" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(50) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "balance" numeric(18,4) NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "portfolios" ADD CONSTRAINT "FK_57fba72db5ac40768b40f0ecfa1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "portfolios" DROP CONSTRAINT "FK_57fba72db5ac40768b40f0ecfa1"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_e9acc6efa76de013e8c1553ed2b"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "portfolios"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
    }

}
