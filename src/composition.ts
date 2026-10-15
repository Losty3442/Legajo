import { LegajoService } from "./application/service";
import { browserRepositories } from "./infrastructure/indexeddb";
import { seed } from "./infrastructure/seed";
export const legajoService = new LegajoService(browserRepositories, seed);
