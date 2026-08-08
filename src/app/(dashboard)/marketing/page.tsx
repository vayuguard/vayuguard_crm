import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { MarketingView } from "@/features/marketing/marketing-view";

export const metadata: Metadata = { title: "Marketing" };

export default function MarketingPage() {
  return (
    <>
      <PageHeader
        title="Marketing"
        description="Campaigns and outbound programs."
      />
      <MarketingView />
    </>
  );
}
