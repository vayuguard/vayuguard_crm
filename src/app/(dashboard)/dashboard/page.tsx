import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Executive overview of pipeline, revenue, and team activity."
      />
      <DashboardView />
    </>
  );
}
