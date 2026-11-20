import { pool } from "../server/db";
import { technicalIdentity } from "../server/accounts";
import { importBackupFile } from "../server/migration";
const path=process.argv[2];if(!path)throw new Error("Indica la ruta del respaldo ZIP.");
const client=await pool.connect();
try{const id=await technicalIdentity(client,"system-import");const result=await importBackupFile(client,{role:"legajos",teacherId:"",userId:id},path);console.log(JSON.stringify(result,null,2));}
finally{client.release();await pool.end();}
