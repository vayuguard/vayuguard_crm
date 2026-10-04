/**
 * Test Zoho Books connection (organization fetch).
 * Usage: npx tsx scripts/zoho-test-connection.ts
 */
import { getOrganization } from "../src/server/integrations/zoho/client";
import { assertZohoCredentialsConfigured } from "../src/server/integrations/zoho/config";

async function main() {
  const cfg = assertZohoCredentialsConfigured();
  console.log(
    `DC=${cfg.dc} org=${cfg.organizationId} syncEnv=${cfg.syncEnabledEnv}`,
  );
  const org = await getOrganization();
  const name =
    (org.organization as { name?: string } | undefined)?.name ??
    (org.organizations?.[0] as { name?: string } | undefined)?.name ??
    "unknown";
  console.log("OK — connected to Zoho Books organization:", name);
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
