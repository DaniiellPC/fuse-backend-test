import { DataSource } from "typeorm";
import { config } from "dotenv";

config();

export default new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USER || "nest_user",
  password: process.env.DB_PASSWORD || "nest_password",
  database: process.env.DB_NAME || "nest_stocks_db",
  synchronize: false,
  logging: false,
  entities: ["dist/**/*.entity{.ts,.js}"],
  migrations: ["dist/database/migrations/*.js"],
  migrationsTableName: "typeorm_migrations",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false, // RDS
});
