import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TasksView } from "@/features/tasks/tasks-view";

export const metadata: Metadata = { title: "Tasks" };

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Tasks"
        description="Follow-ups, calls, and work items across the CRM."
      />
      <TasksView />
    </>
  );
}
