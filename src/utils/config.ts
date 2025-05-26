export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  fuse: {
    apiKey: process.env.FUSE_API_KEY || "",
    baseUrl: process.env.FUSE_API_BASE_URL || "",
    stockPriceCacheTtlMilis: parseInt(
      process.env.FUSE_STOCK_CACHE_TTL_MS || "300000",
      10
    ),
    maxPagesToFetch: parseInt(process.env.MAX_PAGES_TO_FETCH || "100", 10),
    maxApiRetries: parseInt(process.env.FUSE_MAX_API_RETRIES || "3", 10),
  },
  database: {
    type: "postgres",
    host: process.env.DATABASE_HOST || "db",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    username: process.env.DATABASE_USERNAME || "nest_user",
    password: process.env.DATABASE_PASSWORD || "nest_password",
    database: process.env.DATABASE_NAME || "nest_stocks_db",
    synchronize: process.env.DATABASE_SYNCHRONIZE === "true",
    logging: process.env.DATABASE_LOGGING === "true",
    entities: ["dist/**/*.entity{.ts,.js}"],
    autoLoadEntities: true,
  },
  mailtrap: {
    host: process.env.MAILTRAP_HOST || "smtp.mailtrap.io",
    port: parseInt(process.env.MAILTRAP_PORT || "2525", 10),
    secure: process.env.MAILTRAP_SECURE === "true",
    user: process.env.MAILTRAP_USER || "",
    pass: process.env.MAILTRAP_PASS || "",
    maxEmailRetries: parseInt(
      process.env.MAILTRAP_MAX_EMAIL_RETRIES || "3",
      10
    ),
    emailRetryDelay: parseInt(process.env.MAILTRAP_DELAY_MS || "2000", 10),
  },
});
