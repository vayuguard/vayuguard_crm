import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { CalendarView } from "@/features/calendar/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Upcoming meetings and scheduled activities."
      />
      <CalendarView />
    </>
  );
}
