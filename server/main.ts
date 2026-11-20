import { createServer } from "node:http";
import { createApp } from "./app";
import { settings } from "./config";
import { pool } from "./db";
const app=createApp(process.env.API_ONLY!=="1");
const server=createServer(app);
if(app.locals.frontendProxy)server.on("upgrade",app.locals.frontendProxy.upgrade);
server.listen(settings.port,"127.0.0.1",()=>console.log(`Legajo UNP: http://localhost:${settings.port}`));
for(const signal of ["SIGINT","SIGTERM"] as const)process.on(signal,()=>{server.close();void pool.end().then(()=>process.exit(0));});
