import { pool } from "../server/db";
import { bootstrapAccounts } from "../server/accounts";
const client=await pool.connect();
try { await client.query("BEGIN"); const path=await bootstrapAccounts(client);await client.query("COMMIT");console.log(`Cuentas preparadas. Credenciales privadas: ${path}`); }
catch(error){await client.query("ROLLBACK");throw error;}
finally{client.release();await pool.end();}
