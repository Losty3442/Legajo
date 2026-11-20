import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

if (existsSync(".env.local")) loadEnvFile(".env.local");
export const settings = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerUrl: process.env.DATABASE_OWNER_URL ?? "",
  port: Number(process.env.PORT ?? 5173),
  frontendPort: Number(process.env.FRONTEND_PORT ?? 5174),
  dataDir: resolve(process.env.DATA_DIR ?? "data"),
  sessionHours: 8,
};
export function requireDatabaseUrl() {
  if (!settings.databaseUrl) throw new Error("Falta DATABASE_URL. Ejecuta npm run db:setup antes de iniciar.");
  return settings.databaseUrl;
}
