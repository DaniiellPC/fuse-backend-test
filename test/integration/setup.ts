// test/integration/setup.ts
import { DataSource } from "typeorm";

module.exports = async function globalSetup() {
  console.log(
    "\n--- Setting up integration test environment (globalSetup) ---"
  );

  const testDataSource = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT, 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: ["dist/**/*.entity{.ts,.js}"],
    migrations: ["dist/src/database/migrations/*.js"],
    synchronize: false,
    logging: false,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  try {
    await testDataSource.initialize();
    console.log("Test DataSource initialized.");

    console.log("Running TypeORM migrations...");
    await testDataSource.runMigrations();
    console.log("TypeORM migrations executed successfully.");
  } catch (error) {
    console.error("Error during test database setup:", error);

    if (testDataSource.isInitialized) {
      await testDataSource.destroy();
    }
    process.exit(1);
  } finally {
    if (testDataSource.isInitialized) {
      await testDataSource.destroy();
      console.log("Test DataSource closed.");
    }
  }
};
