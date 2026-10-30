import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CommunicationsView } from "@/features/communications/communications-view";

export const metadata: Metadata = { title: "Messages" };

export default function CommunicationsPage() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="Every call, email, WhatsApp and meeting note in one place."
      />
      <CommunicationsView />
    </>
  );
}
