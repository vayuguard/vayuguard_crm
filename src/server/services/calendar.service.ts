import { z } from "zod";
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/server/db/client";
import {
  emptyToNull,
  optionalCuid,
  optionalDate,
} from "@/lib/validators/common";
import { googleCalendarProvider } from "@/server/providers/calendar";

export const calendarQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  types: z.string().optional(),
  organizerId: z.string().cuid().optional(),
  assignedToId: z.string().cuid().optional(),
});

export const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: emptyToNull,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  allDay: z.boolean().optional().default(false),
  eventType: z.string().trim().min(1).default("custom"),
  relatedId: optionalCuid,
  relatedType: emptyToNull,
  syncToGoogle: z.boolean().optional().default(false),
});

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;

export async function getCalendarFeed(query: CalendarQuery) {
  const from = startOfDay(query.from);
  const to = endOfDay(query.to);
  const typeFilter = query.types
    ? query.types.split(",").map((t) => t.trim()).filter(Boolean)
    : null;

  const [meetings, tasks, events] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        deletedAt: null,
        startsAt: { lte: to },
        endsAt: { gte: from },
        ...(query.organizerId ? { organizerId: query.organizerId } : {}),
      },
      include: {
        organizer: {
          select: { id: true, name: true, email: true, image: true },
        },
        lead: { select: { id: true, name: true, leadNumber: true } },
        customer: { select: { id: true, name: true, customerNumber: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        deletedAt: null,
        dueAt: { gte: from, lte: to },
        ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true, image: true },
        },
        lead: { select: { id: true, name: true, leadNumber: true } },
        customer: { select: { id: true, name: true, customerNumber: true } },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: {
        startsAt: { lte: to },
        endsAt: { gte: from },
        ...(typeFilter ? { eventType: { in: typeFilter } } : {}),
      },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  function taskKind(type: string) {
    switch (type) {
      case "CALL":
        return "call" as const;
      case "MEETING":
        return "meeting" as const;
      case "FOLLOW_UP":
        return "follow_up" as const;
      case "REMINDER":
        return "reminder" as const;
      default:
        return "task" as const;
    }
  }

  const meetingItems = meetings.map((m) => ({
    id: m.id,
    kind: "meeting" as const,
    title: m.title,
    description: m.description,
    startsAt: m.startsAt,
    endsAt: m.endsAt,
    allDay: false,
    location: m.location,
    meetingUrl: m.meetingUrl,
    organizer: m.organizer,
    lead: m.lead,
    customer: m.customer,
  }));

  const taskItems = tasks.map((t) => ({
    id: t.id,
    kind: taskKind(t.type),
    title: t.title,
    description: t.description,
    startsAt: t.dueAt,
    endsAt: t.dueAt,
    allDay: true,
    status: t.status,
    priority: t.priority,
    type: t.type,
    assignedTo: t.assignedTo,
    lead: t.lead,
    customer: t.customer,
  }));

  const eventItems = events.map((e) => ({
    id: e.id,
    kind: "event" as const,
    title: e.title,
    description: e.description,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay,
    eventType: e.eventType,
    relatedId: e.relatedId,
    relatedType: e.relatedType,
    externalId: e.externalId,
  }));

  const items = [...meetingItems, ...taskItems, ...eventItems].sort((a, b) => {
    const aTime = a.startsAt ? new Date(a.startsAt).getTime() : 0;
    const bTime = b.startsAt ? new Date(b.startsAt).getTime() : 0;
    return aTime - bTime;
  });

  return {
    from,
    to,
    meetings: meetingItems,
    tasks: taskItems,
    calls: taskItems.filter((t) => t.kind === "call"),
    followUps: taskItems.filter((t) => t.kind === "follow_up"),
    events: eventItems,
    items,
    counts: {
      meetings: meetingItems.length,
      tasks: taskItems.filter((t) => t.kind === "task").length,
      calls: taskItems.filter((t) => t.kind === "call").length,
      followUps: taskItems.filter((t) => t.kind === "follow_up").length,
      events: eventItems.length,
      total: items.length,
    },
  };
}

export async function createCalendarEvent(
  input: CreateCalendarEventInput,
  userId: string,
) {
  if (input.syncToGoogle) {
    const result = await googleCalendarProvider.createEvent(userId, {
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay,
      eventType: input.eventType,
      relatedId: input.relatedId,
      relatedType: input.relatedType,
      createdById: userId,
    });

    const event = await prisma.calendarEvent.findFirst({
      where: {
        OR: [
          { externalId: result.externalId },
          {
            title: input.title,
            createdById: userId,
            startsAt: input.startsAt,
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return { event, sync: result };
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      allDay: input.allDay,
      eventType: input.eventType,
      relatedId: input.relatedId,
      relatedType: input.relatedType,
      createdById: userId,
    },
  });

  return {
    event,
    sync: { success: true, message: "Stored locally only" },
  };
}
