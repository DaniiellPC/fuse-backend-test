// test/integration/setup.ts
import { DataSource } from "typeorm";

module.exports = async function globalSetup() {
  console.log("\n--- Starting globalSetup for integration tests ---");

  const dbHost = process.env.DATABASE_HOST;

  if (!dbHost) {
    console.error(
      "CRITICAL: globalSetup: DATABASE_HOST is undefined or empty! This will likely cause ECONNREFUSED."
    );
  }

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
    console.log("Test DataSource initialized successfully in globalSetup.");

    console.log("Running TypeORM migrations in globalSetup...");
    const executedMigrations = await testDataSource.runMigrations();
    if (executedMigrations.length > 0) {
      console.log(
        `globalSetup: Successfully executed ${executedMigrations.length} migrations:`
      );
      executedMigrations.forEach((mig) => console.log(` - ${mig.name}`));
    } else {
      console.log("globalSetup: No new migrations to execute.");
    }
    console.log("TypeORM migrations step completed in globalSetup.");
  } catch (error) {
    console.error("CRITICAL ERROR during globalSetup:", error);
    if (testDataSource.isInitialized) {
      await testDataSource.destroy();
    }
    process.exit(1);
  } finally {
    if (testDataSource.isInitialized) {
      await testDataSource.destroy();
      console.log("Test DataSource closed in globalSetup.");
    }
    console.log("--- globalSetup finished ---");
  }
};
