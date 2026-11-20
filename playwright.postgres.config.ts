import {defineConfig,devices} from "@playwright/test";
import {loadEnvFile} from "node:process";
loadEnvFile(".env.local");
if(!process.env.TEST_DATABASE_URL||!process.env.TEST_DATABASE_OWNER_URL)throw new Error("Prepara legajos_unp_test antes de ejecutar estas pruebas.");
Object.assign(process.env,{DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_OWNER_URL:process.env.TEST_DATABASE_OWNER_URL,PORT:"5183",FRONTEND_PORT:"5184",DATA_DIR:".local/test-data"});
export default defineConfig({testDir:"./tests",testMatch:["postgres.spec.ts","postgres-browser.spec.ts"],workers:1,timeout:90000,expect:{timeout:20000},reporter:"list",outputDir:"test-results/postgres",use:{...devices["Desktop Chrome"],channel:"msedge",baseURL:"http://localhost:5183",screenshot:"only-on-failure",trace:"retain-on-failure"},webServer:{command:'"'+process.execPath+'" --import tsx scripts/local-app.mjs dev',url:"http://localhost:5183/",reuseExistingServer:false,timeout:120000}});
