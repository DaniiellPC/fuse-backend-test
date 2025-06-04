import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";

/**
 * Clears all tables in the database.
 * Useful to ensure a clean state before each test or suite.
 * Requires the NestJS application to be initialized and connected to the database.
 */
export async function clearDatabase(app: INestApplication) {
  const dataSource = app.get(DataSource);
  if (!dataSource?.isInitialized) {
    console.error(
      "DataSource is not initialized in the NestJS application. Cannot clear the database."
    );
    return;
  }

  const entities = dataSource.entityMetadatas;
  const tableNames = entities
    .map((entity) => `"${entity.tableName}"`)
    .join(", ");

  if (tableNames) {
    try {
      await dataSource.query(`SET session_replication_role = 'replica';`);
      await dataSource.query(
        `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`
      );
      await dataSource.query(`SET session_replication_role = 'origin';`);
      console.log(`Tables ${tableNames} truncated.`);
    } catch (error) {
      console.error("Error truncating tables:", error);
      await dataSource.query(`SET session_replication_role = 'origin';`);
      throw error;
    }
  } else {
    console.warn("No entities found to truncate.");
  }
}

/**
 * Seed initial data for tests.
 */
export async function seedDatabase(app: INestApplication) {
  const dataSource = app.get(DataSource);
  if (!dataSource?.isInitialized) {
    console.error(
      "DataSource is not initialized in the NestJS application. Cannot seed the database."
    );
    return;
  }

  try {
    await dataSource.runMigrations();
    console.log("Migrations executed successfully.");
  } catch (error) {
    console.error("Error running migrations or seeding database:", error);
    throw error;
  }
}
