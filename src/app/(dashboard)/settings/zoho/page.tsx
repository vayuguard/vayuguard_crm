import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ZohoSyncView } from "@/features/zoho/zoho-sync-view";

export const metadata: Metadata = { title: "Zoho Sync" };

export default function ZohoSyncPage() {
  return (
    <>
      <PageHeader
        title="Zoho Sync"
        description="Connection status, queue health, and failed job retries for Zoho Books."
      />
      <ZohoSyncView />
    </>
  );
}
