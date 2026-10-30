import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { MarketingView } from "@/features/marketing/marketing-view";

export const metadata: Metadata = { title: "Campaigns" };

export default function MarketingPage() {
  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Bulk email and message campaigns."
      />
      <MarketingView />
    </>
  );
}
