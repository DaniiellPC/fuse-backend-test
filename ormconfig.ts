import { DataSource } from "typeorm";

export default new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT, 10),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  synchronize: false,
  logging: false,
  entities: ["dist/**/*.entity{.ts,.js}"],
  migrations: ["dist/src/database/migrations/*.js"],
  migrationsTableName: "typeorm_migrations",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false, // RDS
});
