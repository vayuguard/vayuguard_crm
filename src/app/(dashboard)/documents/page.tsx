import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentsView } from "@/features/documents/documents-view";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Documents"
        description="Files attached to CRM records."
      />
      <DocumentsView />
    </>
  );
}
