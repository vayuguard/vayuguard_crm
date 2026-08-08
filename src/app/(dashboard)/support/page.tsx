import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SupportView } from "@/features/support/support-view";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <>
      <PageHeader
        title="Support"
        description="Customer tickets and service requests."
      />
      <SupportView />
    </>
  );
}
