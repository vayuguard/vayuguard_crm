import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { LeadsView } from "@/features/leads/leads-view";

export const metadata: Metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  return (
    <>
      <PageHeader
        title="Leads"
        description="Capture, qualify, and convert inbound opportunities."
      />
      <LeadsView />
    </>
  );
}
