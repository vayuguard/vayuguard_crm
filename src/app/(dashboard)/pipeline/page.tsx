import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PipelineView } from "@/features/pipeline/pipeline-view";

export const metadata: Metadata = { title: "Deals board" };

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Deals board"
        description="Each card is a possible sale. Drag a card to the next column when the customer moves forward."
      />
      <PipelineView />
    </>
  );
}
