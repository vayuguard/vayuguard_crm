import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CommunicationsView } from "@/features/communications/communications-view";

export const metadata: Metadata = { title: "Messages" };

export default function CommunicationsPage() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="Who talked, what was said, what is being discussed now, and what still needs to be covered — with the exact time."
      />
      <CommunicationsView />
    </>
  );
}
