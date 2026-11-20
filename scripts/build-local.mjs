import { spawnSync } from "node:child_process";
import { build } from "esbuild";
const result=spawnSync(process.execPath,["scripts/run-framework.mjs","build"],{stdio:"inherit",env:process.env});
if(result.status!==0)process.exit(result.status??1);
await build({entryPoints:["server/main.ts"],outfile:".local/server/main.mjs",bundle:true,packages:"external",platform:"node",format:"esm",target:"node22",sourcemap:true});
console.log("Backend local compilado en .local/server/main.mjs");
