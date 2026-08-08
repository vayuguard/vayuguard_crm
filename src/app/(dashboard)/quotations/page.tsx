import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationsView } from "@/features/quotations/quotations-view";

export const metadata: Metadata = { title: "Quotations" };

export default function QuotationsPage() {
  return (
    <>
      <PageHeader
        title="Quotations"
        description="Proposals and quotes sent to prospects."
      />
      <QuotationsView />
    </>
  );
}
