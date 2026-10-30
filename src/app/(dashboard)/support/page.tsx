import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SupportView } from "@/features/support/support-view";

export const metadata: Metadata = { title: "Tickets" };

export default function SupportPage() {
  return (
    <>
      <PageHeader
        title="Tickets"
        description="Customer complaints and service requests."
      />
      <SupportView />
    </>
  );
}
