import type { Metadata } from "next";
import { LeadDetailView } from "@/features/leads/lead-detail-view";

export const metadata: Metadata = {
  title: "Lead detail",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <LeadDetailView leadId={id} />;
}
