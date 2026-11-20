import {readFile} from "node:fs/promises";
import {pool} from "../server/db";
import {PgStore} from "../server/store";
import {decodeBackup,verifyImported} from "../server/migration";
const path=process.argv[2];if(!path)throw new Error("Indica el ZIP que se importó: npm run db:verify -- ruta.zip");
const parsed=decodeBackup(new Uint8Array(await readFile(path)));const client=await pool.connect();
try{await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");await verifyImported(new PgStore(client,{role:"legajos",teacherId:"",userId:"verification"}),parsed.data,parsed.documents);await client.query("COMMIT");console.log(JSON.stringify({...parsed.report,comparacion:"Coinciden todos los registros, históricos, relaciones y archivos SHA-256."},null,2));}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();await pool.end();}
