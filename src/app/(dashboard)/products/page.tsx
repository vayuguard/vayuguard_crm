import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ProductsView } from "@/features/products/products-view";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Products"
        description="Catalog items used on quotations and invoices."
      />
      <ProductsView />
    </>
  );
}
