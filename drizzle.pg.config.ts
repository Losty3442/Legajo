import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
if (existsSync(".env.local")) loadEnvFile(".env.local");
export default defineConfig({ schema: "./db/schema.pg.ts", out: "./drizzle-pg/generated", dialect: "postgresql", dbCredentials: { url: process.env.DATABASE_OWNER_URL ?? "" } });
