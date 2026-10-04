/**
 * One-time: exchange Zoho Self Client grant code → refresh token.
 *
 * Usage:
 *   npx tsx scripts/zoho-exchange-token.ts <GRANT_CODE>
 *
 * Prereq: ZOHO_DC, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET in .env
 * Put the printed refresh token into ZOHO_REFRESH_TOKEN (never commit it).
 */
import { exchangeGrantCode } from "../src/server/integrations/zoho/token";

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error("Usage: npx tsx scripts/zoho-exchange-token.ts <GRANT_CODE>");
    process.exit(1);
  }

  const result = await exchangeGrantCode(code);
  console.log("OK — add this to your .env (do not paste it in chat):");
  console.log("ZOHO_REFRESH_TOKEN=<copied from below>");
  console.log("---");
  console.log(result.refreshToken);
  console.log("---");
  if (result.apiDomain) console.log("api_domain:", result.apiDomain);
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
