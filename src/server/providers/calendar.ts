import { prisma } from "@/server/db/client";

export type CalendarEventInput = {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  eventType: string;
  relatedId?: string | null;
  relatedType?: string | null;
  createdById?: string | null;
};

export type CalendarSyncResult = {
  success: boolean;
  externalId?: string;
  message: string;
};

export interface CalendarProvider {
  readonly name: string;
  createEvent(
    userId: string,
    input: CalendarEventInput,
  ): Promise<CalendarSyncResult>;
  updateEvent(
    userId: string,
    externalId: string,
    input: Partial<CalendarEventInput>,
  ): Promise<CalendarSyncResult>;
  deleteEvent(userId: string, externalId: string): Promise<CalendarSyncResult>;
  syncFromProvider(userId: string): Promise<CalendarSyncResult>;
}

/**
 * Google Calendar stub — persists local CalendarEvent and records sync intent.
 * Replace with real Google Calendar API calls when credentials are configured.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  readonly name = "google";

  async createEvent(
    userId: string,
    input: CalendarEventInput,
  ): Promise<CalendarSyncResult> {
    const account = await prisma.calendarSyncAccount.findFirst({
      where: { userId, provider: this.name, isActive: true },
    });

    const event = await prisma.calendarEvent.create({
      data: {
        title: input.title,
        description: input.description ?? undefined,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        allDay: input.allDay ?? false,
        eventType: input.eventType,
        relatedId: input.relatedId ?? undefined,
        relatedType: input.relatedType ?? undefined,
        createdById: input.createdById ?? userId,
        syncAccountId: account?.id,
        externalId: account ? `pending-google-${Date.now()}` : undefined,
      },
    });

    return {
      success: true,
      externalId: event.externalId ?? event.id,
      message: account
        ? "Event stored locally; Google sync queued (stub)"
        : "Event stored locally; no Google account linked",
    };
  }

  async updateEvent(
    userId: string,
    externalId: string,
    input: Partial<CalendarEventInput>,
  ): Promise<CalendarSyncResult> {
    const event = await prisma.calendarEvent.findFirst({
      where: {
        OR: [{ externalId }, { id: externalId }],
        createdById: userId,
      },
    });

    if (!event) {
      return { success: false, message: "Calendar event not found" };
    }

    await prisma.calendarEvent.update({
      where: { id: event.id },
      data: {
        title: input.title,
        description: input.description ?? undefined,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        allDay: input.allDay,
        eventType: input.eventType,
        relatedId: input.relatedId ?? undefined,
        relatedType: input.relatedType ?? undefined,
      },
    });

    return {
      success: true,
      externalId: event.externalId ?? event.id,
      message: "Event updated locally; Google sync queued (stub)",
    };
  }

  async deleteEvent(
    userId: string,
    externalId: string,
  ): Promise<CalendarSyncResult> {
    const event = await prisma.calendarEvent.findFirst({
      where: {
        OR: [{ externalId }, { id: externalId }],
        createdById: userId,
      },
    });

    if (!event) {
      return { success: false, message: "Calendar event not found" };
    }

    await prisma.calendarEvent.delete({ where: { id: event.id } });

    return {
      success: true,
      externalId,
      message: "Event deleted locally; Google delete queued (stub)",
    };
  }

  async syncFromProvider(userId: string): Promise<CalendarSyncResult> {
    const account = await prisma.calendarSyncAccount.findFirst({
      where: { userId, provider: this.name, isActive: true },
    });

    if (!account) {
      return {
        success: false,
        message: "No active Google Calendar sync account",
      };
    }

    await prisma.calendarSyncAccount.update({
      where: { id: account.id },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      message: "Google Calendar sync intent recorded (stub)",
    };
  }
}

export const googleCalendarProvider = new GoogleCalendarProvider();
