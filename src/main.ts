// Startpunkt: node src/main.ts
import { describeConfig } from "./config.ts";
import { startScheduler } from "./game/scheduler.ts";
import { startHttp } from "./http/server.ts";

for (const line of describeConfig()) console.log(line);
startHttp();
startScheduler();
