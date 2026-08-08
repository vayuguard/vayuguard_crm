import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsView } from "@/features/reports/reports-view";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Performance metrics across sales and operations."
      />
      <ReportsView />
    </>
  );
}
