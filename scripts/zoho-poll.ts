import { pullZohoUpdates } from "../src/server/integrations/zoho/jobs/pull-updates";
import { enqueueZohoJob } from "../src/server/integrations/zoho/queue";

async function main() {
  const mode = process.argv[2] ?? "once";
  if (mode === "enqueue") {
    await enqueueZohoJob("pull_updates", {});
    console.log("Enqueued pull_updates job");
    return;
  }
  const result = await pullZohoUpdates();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
