import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { AuditView } from "@/features/audit/audit-view";

export const metadata: Metadata = { title: "Audit" };

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Audit"
        description="Security and change history across the CRM."
      />
      <AuditView />
    </>
  );
}
