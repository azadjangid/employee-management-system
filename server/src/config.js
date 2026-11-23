import "dotenv/config";

const env = process.env.NODE_ENV || "development";
const DEFAULT_SECRET = "change-me-to-a-long-random-string";

export const config = {
  env,
  isProduction: env === "production",
  isTest: env === "test",
  port: Number(process.env.PORT) || 5000,
  databaseUrl:
    process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/ems",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  appUrl: process.env.APP_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || DEFAULT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  rememberMeExpiresIn: process.env.REMEMBER_ME_EXPIRES_IN || "7d",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  maxUploadBytes: 5 * 1024 * 1024,
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || (env === "test" ? 4 : 10),
};

if (config.jwtSecret === DEFAULT_SECRET || config.jwtSecret.length < 32) {
  if (config.isProduction) {
    throw new Error("JWT_SECRET must be set to a long random string in production");
  }
  if (!config.isTest) {
    console.warn("Warning: using a weak development JWT_SECRET. Set JWT_SECRET in server/.env.");
  }
}
