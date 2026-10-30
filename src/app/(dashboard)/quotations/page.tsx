import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationsView } from "@/features/quotations/quotations-view";

export const metadata: Metadata = { title: "Quotes" };

export default function QuotationsPage() {
  return (
    <>
      <PageHeader
        title="Quotes"
        description="Price quotes you send to customers."
      />
      <QuotationsView />
    </>
  );
}
