import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import {randomUUID} from "node:crypto";
import { loadEnvFile } from "node:process";
import { settings } from "../server/config.ts";

if(existsSync(".env.local"))loadEnvFile(".env.local");
const mode=process.argv[2]??"dev";
if(!["dev","start"].includes(mode))throw new Error("Usa dev o start.");
mkdirSync(settings.dataDir,{recursive:true});
const runtimeFile=resolve(settings.dataDir,"runtime.json"),stopFile=resolve(settings.dataDir,"runtime.stop");
if(existsSync(runtimeFile)){const prior=JSON.parse(readFileSync(runtimeFile,"utf8"));let alive=false;try{process.kill(prior.pid,0);alive=true;}catch{}if(alive)throw new Error("La aplicación ya está iniciada. Usa npm stop antes de reiniciarla.");}
const nonce=randomUUID();writeFileSync(runtimeFile,JSON.stringify({pid:process.pid,nonce,mode,port:settings.port}),{mode:0o600});
process.on("exit",()=>{try{if(JSON.parse(readFileSync(runtimeFile,"utf8")).nonce===nonce){unlinkSync(runtimeFile);if(existsSync(stopFile))unlinkSync(stopFile);}}catch{}});
const frontend=mode==="dev"?["scripts/run-framework.mjs","dev","--port",String(settings.frontendPort)]:["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","dev","--config","dist/server/wrangler.json","--local","--persist-to",process.env.WRANGLER_STATE_DIR??".wrangler/state","--ip","127.0.0.1","--inspector-port","0","--port",String(settings.frontendPort)];
const backend=mode==="dev"?["--import","tsx","server/main.ts"]:[".local/server/main.mjs"];
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children){if(child.exitCode===null){if(process.platform==="win32")spawn("taskkill.exe",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore",windowsHide:true});else child.kill("SIGTERM");}}setTimeout(()=>process.exit(code),600).unref();}
for(const args of [frontend,backend]){const child=spawn(process.execPath,args,{cwd:resolve('.'),env:{...process.env,LEGADO_LOCAL_API:"1"},stdio:"inherit",windowsHide:true});children.push(child);child.on("error",error=>{console.error(error.message);stop(1);});child.on("exit",code=>{if(!stopping)stop(code??1);});}
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>stop());
setInterval(()=>{try{if(readFileSync(stopFile,"utf8")===nonce)stop();}catch{}},500).unref();
