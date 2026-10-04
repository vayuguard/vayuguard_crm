import { prisma } from "@/server/db/client";

/**
 * Effective sync flag: DB override (admin UI) wins over env.
 * Env ZOHO_SYNC_ENABLED defaults to false.
 */
export async function isZohoSyncEnabled(): Promise<boolean> {
  try {
    const row = await prisma.zohoSyncState.findUnique({
      where: { key: "sync_enabled" },
    });
    if (row?.value === "true") return true;
    if (row?.value === "false") return false;
  } catch {
    // DB unavailable (unit tests without prisma) — fall through to env
  }
  return (process.env.ZOHO_SYNC_ENABLED ?? "false").toLowerCase() === "true";
}

export async function setZohoSyncEnabled(enabled: boolean) {
  return prisma.zohoSyncState.upsert({
    where: { key: "sync_enabled" },
    create: { key: "sync_enabled", value: enabled ? "true" : "false" },
    update: { value: enabled ? "true" : "false" },
  });
}
