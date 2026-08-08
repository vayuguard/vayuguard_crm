import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CustomersView } from "@/features/customers/customers-view";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader
        title="Customers"
        description="Accounts and organizations you sell to."
      />
      <CustomersView />
    </>
  );
}
