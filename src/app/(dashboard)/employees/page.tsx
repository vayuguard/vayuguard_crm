import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeesView } from "@/features/employees/employees-view";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage() {
  return (
    <>
      <PageHeader
        title="Employees"
        description="Team members and role assignments."
      />
      <EmployeesView />
    </>
  );
}
