import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeesView } from "@/features/employees/employees-view";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage() {
  return (
    <>
      <PageHeader
        title="Employees"
        description="Set who reports to whom. A manager can see their team's leads, deals, tasks and calendar."
      />
      <EmployeesView />
    </>
  );
}
