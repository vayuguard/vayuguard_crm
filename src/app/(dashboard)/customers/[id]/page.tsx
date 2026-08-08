import type { Metadata } from "next";
import { CustomerDetailView } from "@/features/customers/customer-detail-view";

export const metadata: Metadata = {
  title: "Customer detail",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <CustomerDetailView customerId={id} />;
}
