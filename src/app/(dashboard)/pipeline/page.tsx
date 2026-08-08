import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PipelineView } from "@/features/pipeline/pipeline-view";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Drag deals across stages to update your forecast."
      />
      <PipelineView />
    </>
  );
}
