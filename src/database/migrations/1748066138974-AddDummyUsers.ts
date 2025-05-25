import { MigrationInterface, QueryRunner } from "typeorm";
import * as bcrypt from "bcrypt";

export class AddDummyUsers1748066138974 implements MigrationInterface {
  name = "AddDummyUsers1748066138974";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const usersData = [
      {
        id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        username: "dummyuser1",
        email: "user1@example.com",
        password: "password123",
        balance: 1000.0,
      },
      {
        id: "bcff8bd0-3e6b-4edb-a3e9-94607e895b37",
        username: "dummyuser2",
        email: "user2@example.com",
        password: "password123",
        balance: 0.0,
      },
      {
        id: "20354d7a-e4fe-47af-8ff6-187bca92f3f9",
        username: "dummyuser3",
        email: "user3@example.com",
        password: "password123",
        balance: 100.75,
      },
      {
        id: "caa8b54a-eb5e-4134-8ae2-a3946a428ec7",
        username: "dummyuser4",
        email: "user4@example.com",
        password: "password123",
        balance: 3000.0,
      },
      {
        id: "bd2cbad1-6ccf-48e3-bb92-bc9961bc011e",
        username: "dummyuser5",
        email: "user5@example.com",
        password: "password123",
        balance: 1500.0,
      },
      {
        id: "b5e2cf01-8bb6-4fcd-ad88-0efb611195da",
        username: "dummyuser6",
        email: "user6@example.com",
        password: "password123",
        balance: 2000.0,
      },
      {
        id: "f58a75af-5e21-4ef7-99e2-8cab60d24edf",
        username: "dummyuser7",
        email: "user7@example.com",
        password: "password123",
        balance: 750.0,
      },
      {
        id: "397ce57f-675d-4b99-8260-465245053aa4",
        username: "dummyuser8",
        email: "user8@example.com",
        password: "password123",
        balance: 4000.5,
      },
      {
        id: "b19b88b0-d88f-4acc-9b7f-6b5595606796",
        username: "dummyuser9",
        email: "user9@example.com",
        password: "password123",
        balance: 1200.0,
      },
      {
        id: "d69c0416-f6ed-4ffc-b2dd-d9d1c990ab48",
        username: "dummyuser10",
        email: "user10@example.com",
        password: "password123",
        balance: 3500.0,
      },
    ];

    for (const userData of usersData) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const now = new Date();

      const existingUser = await queryRunner.query(
        `SELECT id FROM "users" WHERE id = $1 OR email = $2 OR username = $3`,
        [userData.id, userData.email, userData.username]
      );

      if (existingUser.length === 0) {
        await queryRunner.query(
          `INSERT INTO "users" ("id", "username", "email", "password_hash", "balance", "created_at", "updated_at") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userData.id,
            userData.username,
            userData.email,
            hashedPassword,
            userData.balance,
            now,
            now,
          ]
        );
        console.log(`Dummy user '${userData.email}' added.`);
      } else {
        console.log(`Dummy user '${userData.email}' already exists, skipping.`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const userIds = [
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "bcff8bd0-3e6b-4edb-a3e9-94607e895b37",
      "20354d7a-e4fe-47af-8ff6-187bca92f3f9",
      "caa8b54a-eb5e-4134-8ae2-a3946a428ec7",
      "bd2cbad1-6ccf-48e3-bb92-bc9961bc011e",
      "b5e2cf01-8bb6-4fcd-ad88-0efb611195da",
      "f58a75af-5e21-4ef7-99e2-8cab60d24edf",
      "397ce57f-675d-4b99-8260-465245053aa4",
      "b19b88b0-d88f-4acc-9b7f-6b5595606796",
      "d69c0416-f6ed-4ffc-b2dd-d9d1c990ab48",
    ];

    await queryRunner.query(
      `DELETE FROM "users" WHERE id IN (${userIds
        .map((id) => `'${id}'`)
        .join(",")})`
    );
    console.log(`Usuarios dummy eliminados.`);
  }
}
