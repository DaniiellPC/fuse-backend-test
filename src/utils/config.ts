export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  fuse: {
    apiKey: process.env.FUSE_API_KEY || "",
    baseUrl: process.env.FUSE_API_BASE_URL || "",
    stockPriceCacheTtlMilis: parseInt(
      process.env.FUSE_STOCK_CACHE_TTL_MS || "300000",
      10
    ),
    maxSameNextTokenRetries: parseInt(
      process.env.MAX_SAME_NEXT_TOKEN_RETRIES || "3",
      10
    ),
    maxPagesToFetch: parseInt(process.env.MAX_PAGES_TO_FETCH || "100", 10),
    stockRefreshCronIntervalMs: parseInt(
      process.env.FUSE_STOCK_REFRESH_CRON_INTERVAL_MS ||
        (5 * 60 * 1000).toString(),
      10
    ),
    maxApiRetries: parseInt(process.env.FUSE_MAX_API_RETRIES || "3", 10),
  },
  database: {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USER || "nest_user",
    password: process.env.DB_PASSWORD || "nest_password",
    database: process.env.DB_NAME || "nest_stocks_db",
    synchronize: process.env.DB_SYNCHRONIZE === "true",
    logging: process.env.DB_LOGGING === "true",
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
