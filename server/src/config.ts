import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI_SIGNIN: z.string().url(),
  GOOGLE_REDIRECT_URI_CONNECT: z.string().url(),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  SESSION_COOKIE_NAME: z.string().default("app_session"),
  SESSION_TTL_DAYS: z.coerce.number().default(30),
  PORT: z.coerce.number().default(3000),
  MOBILE_REDIRECT_SCHEME: z.string().default("cloudmesh"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export const config = envSchema.parse(process.env);
