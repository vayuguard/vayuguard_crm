import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { InvoicesView } from "@/features/invoices/invoices-view";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <>
      <PageHeader
        title="Invoices"
        description="Billing documents and payment status."
      />
      <InvoicesView />
    </>
  );
}
