import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {settings} from "../server/config.ts";
const runtime=resolve(settings.dataDir,"runtime.json");
if(!existsSync(runtime))console.log("La aplicación no está iniciada.");
else{const {nonce}=JSON.parse(readFileSync(runtime,"utf8"));writeFileSync(resolve(settings.dataDir,"runtime.stop"),nonce,{mode:0o600});console.log("Se solicitó detener juntos el frontend y el backend de esta aplicación.");}
