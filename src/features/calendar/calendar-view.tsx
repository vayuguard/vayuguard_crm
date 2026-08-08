"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  eachHourOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  formatISO,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfHour,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type CalendarItem = {
  id: string;
  title: string;
  startAt?: string;
  startsAt?: string;
  endsAt?: string;
  location?: string | null;
  status?: string | null;
  kind?: string;
  type?: string;
  allDay?: boolean;
};

type ViewMode = "month" | "week" | "day";

function normalizeFeed(data: unknown): CalendarItem[] {
  if (Array.isArray(data)) return data as CalendarItem[];
  if (!data || typeof data !== "object") return [];

  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.items)) {
    return obj.items as CalendarItem[];
  }

  const items: CalendarItem[] = [];
  const pushAll = (key: string, defaultKind: string) => {
    for (const row of unwrapList<CalendarItem>(obj[key])) {
      items.push({ ...row, kind: row.kind ?? defaultKind });
    }
  };
  pushAll("meetings", "meeting");
  pushAll("calls", "call");
  pushAll("followUps", "follow_up");
  pushAll("tasks", "task");
  pushAll("events", "event");

  if (!items.length) {
    for (const event of unwrapList<CalendarItem>(obj.events)) {
      items.push({ ...event, kind: event.kind ?? "event" });
    }
  }

  // Dedupe by id+kind
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function itemDate(item: CalendarItem): Date | null {
  const raw = item.startsAt ?? item.startAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function kindColor(kind?: string) {
  switch (kind) {
    case "meeting":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "call":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "follow_up":
      return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "task":
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function CalendarView() {
  const [view, setView] = React.useState<ViewMode>("month");
  const [cursor, setCursor] = React.useState(() => startOfDay(new Date()));
  const [selectedDay, setSelectedDay] = React.useState(() => new Date());

  const range = React.useMemo(() => {
    if (view === "day") {
      return { from: startOfDay(cursor), to: endOfDay(cursor) };
    }
    if (view === "week") {
      return {
        from: startOfWeek(cursor, { weekStartsOn: 1 }),
        to: endOfWeek(cursor, { weekStartsOn: 1 }),
      };
    }
    const monthStart = startOfMonth(cursor);
    return { from: monthStart, to: endOfMonth(monthStart) };
  }, [view, cursor]);

  const query = useQuery({
    queryKey: ["calendar", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        from: formatISO(range.from, { representation: "date" }),
        to: formatISO(range.to, { representation: "date" }),
      });
      const res = await apiFetch<unknown>(`/api/calendar?${params}`);
      return normalizeFeed(res.data);
    },
  });

  const items = query.data ?? [];

  function navigate(dir: -1 | 1) {
    setCursor((c) => {
      if (view === "day") return addDays(c, dir);
      if (view === "week") return addWeeks(c, dir);
      return addMonths(c, dir);
    });
  }

  function goToday() {
    const today = new Date();
    setCursor(startOfDay(today));
    setSelectedDay(today);
  }

  const title =
    view === "day"
      ? format(cursor, "EEEE, d MMM yyyy")
      : view === "week"
        ? `${format(range.from, "d MMM")} – ${format(range.to, "d MMM yyyy")}`
        : format(startOfMonth(cursor), "MMMM yyyy");

  if (query.isLoading) return <LoadingSkeleton rows={6} />;

  if (query.isError) {
    return (
      <EmptyState
        title="Calendar unavailable"
        description={(query.error as Error).message}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navigate(-1)}
            aria-label="Previous"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h2 className="min-w-[12rem] text-center text-sm font-semibold">
            {title}
          </h2>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => navigate(1)}
            aria-label="Next"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border p-0.5">
            {(
              [
                ["month", "Monthly"],
                ["week", "Weekly"],
                ["day", "Daily"],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                variant={view === mode ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(mode)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={goToday}>
            Today
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <MonthGrid
          month={startOfMonth(cursor)}
          items={items}
          selectedDay={selectedDay}
          onSelectDay={(d) => {
            setSelectedDay(d);
            setCursor(startOfDay(d));
          }}
        />
      ) : view === "week" ? (
        <WeekGrid
          from={range.from}
          to={range.to}
          items={items}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      ) : (
        <DayTimeline day={cursor} items={items} />
      )}

      {view !== "day" ? (
        <DayList
          day={view === "month" ? selectedDay : selectedDay}
          items={items.filter((item) => {
            const d = itemDate(item);
            return d ? isSameDay(d, selectedDay) : false;
          })}
        />
      ) : null}
    </div>
  );
}

function MonthGrid({
  month,
  items,
  selectedDay,
  onSelectDay,
}: {
  month: Date;
  items: CalendarItem[];
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = items.filter((item) => {
            const d = itemDate(item);
            return d ? isSameDay(d, day) : false;
          });
          const inMonth = isSameMonth(day, month);
          const selected = isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-20 border-r border-b border-border p-1.5 text-left transition-colors hover:bg-muted/50",
                !inMonth && "bg-muted/20 text-muted-foreground",
                selected && "bg-primary/10 ring-1 ring-inset ring-primary/40",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  isSameDay(day, new Date()) &&
                    "bg-primary text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 2).map((item) => (
                  <p
                    key={`${item.kind}-${item.id}`}
                    className={cn(
                      "truncate rounded px-1 text-[10px]",
                      kindColor(item.kind),
                    )}
                  >
                    {item.title}
                  </p>
                ))}
                {dayItems.length > 2 ? (
                  <p className="text-[10px] text-muted-foreground">
                    +{dayItems.length - 2} more
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({
  from,
  to,
  items,
  selectedDay,
  onSelectDay,
}: {
  from: Date;
  to: Date;
  items: CalendarItem[];
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
}) {
  const days = eachDayOfInterval({ start: from, end: to });
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const dayItems = items.filter((item) => {
          const d = itemDate(item);
          return d ? isSameDay(d, day) : false;
        });
        const selected = isSameDay(day, selectedDay);
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDay(day)}
            className={cn(
              "min-h-36 rounded-xl border border-border p-2 text-left hover:bg-muted/40",
              selected && "ring-1 ring-primary/40 bg-primary/5",
            )}
          >
            <p className="text-xs font-semibold">
              {format(day, "EEE d")}
            </p>
            <div className="mt-2 space-y-1">
              {dayItems.slice(0, 5).map((item) => (
                <p
                  key={`${item.kind}-${item.id}`}
                  className={cn(
                    "truncate rounded px-1.5 py-0.5 text-[11px]",
                    kindColor(item.kind),
                  )}
                >
                  {item.title}
                </p>
              ))}
              {dayItems.length > 5 ? (
                <p className="text-[10px] text-muted-foreground">
                  +{dayItems.length - 5} more
                </p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayTimeline({ day, items }: { day: Date; items: CalendarItem[] }) {
  const hours = eachHourOfInterval({
    start: startOfHour(startOfDay(day)),
    end: startOfHour(addDays(startOfDay(day), 1)),
  }).slice(0, 24);

  const dayItems = items.filter((item) => {
    const d = itemDate(item);
    return d ? isSameDay(d, day) : false;
  });

  if (dayItems.length === 0) {
    return (
      <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        No events this day.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {hours.map((hour) => {
        const slotItems = dayItems.filter((item) => {
          const d = itemDate(item);
          return d ? d.getHours() === hour.getHours() : false;
        });
        if (!slotItems.length) return null;
        return (
          <div
            key={hour.toISOString()}
            className="grid grid-cols-[4rem_1fr] border-b border-border last:border-b-0"
          >
            <div className="bg-muted/30 px-2 py-3 text-right text-[11px] text-muted-foreground">
              {format(hour, "HH:mm")}
            </div>
            <div className="min-h-12 space-y-1 p-2">
              {slotItems.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs",
                    kindColor(item.kind),
                  )}
                >
                  <span className="font-medium">{item.title}</span>
                  {item.kind ? (
                    <span className="ml-2 opacity-70">{item.kind}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayList({ day, items }: { day: Date; items: CalendarItem[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">
        {format(day, "EEEE, d MMM yyyy")}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events this day.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(item.startsAt ?? item.startAt, {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
              </div>
              {item.kind ? (
                <Badge variant="outline" className={kindColor(item.kind)}>
                  {item.kind}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
