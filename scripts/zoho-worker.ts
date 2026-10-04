import { runZohoWorkerLoop } from "../src/server/integrations/zoho/worker";

runZohoWorkerLoop(Number(process.env.ZOHO_WORKER_INTERVAL_MS ?? 5000)).catch(
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
