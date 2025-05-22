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
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  },
});
