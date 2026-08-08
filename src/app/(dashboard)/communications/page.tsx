import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CommunicationsView } from "@/features/communications/communications-view";

export const metadata: Metadata = { title: "Communications" };

export default function CommunicationsPage() {
  return (
    <>
      <PageHeader
        title="Communications"
        description="Emails, calls, WhatsApp, and meeting notes across leads and customers."
      />
      <CommunicationsView />
    </>
  );
}
