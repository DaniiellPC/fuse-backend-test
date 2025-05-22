export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  fuse: {
    fuseApiKey: process.env.FUSE_API_KEY || "",
    fuseBaseUrl: process.env.FUSE_API_BASE_URL || "",
  },
  database: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
  },
});
