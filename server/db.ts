import { Pool, types } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema.pg";
import { requireDatabaseUrl } from "./config";

types.setTypeParser(1700, Number);
types.setTypeParser(20, Number);
export const pool = new Pool({ connectionString: requireDatabaseUrl(), max: 8, connectionTimeoutMillis: 5000, application_name:"legajo-unp-api" });
pool.on("error",error=>console.warn(JSON.stringify({event:"postgres_idle_connection_error",code:(error as NodeJS.ErrnoException).code??"DATABASE_ERROR"})));
export const database = drizzle(pool, { schema });
