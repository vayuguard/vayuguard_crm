import { NotificationType, type Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import { emptyToNull } from "@/lib/validators/common";

export const createNotificationSchema = z.object({
  userId: z.string().cuid(),
  type: z.nativeEnum(NotificationType),
  title: z.string().trim().min(1).max(200),
  body: emptyToNull,
  link: emptyToNull,
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const notificationFiltersSchema = z.object({
  isRead: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  type: z.nativeEnum(NotificationType).optional(),
});

export const markNotificationsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200).optional(),
  all: z.boolean().optional().default(false),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type NotificationFilters = z.infer<typeof notificationFiltersSchema>;
export type MarkNotificationsInput = z.infer<typeof markNotificationsSchema>;

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listNotifications(
  userId: string,
  pagination: PaginationInput,
  filters: NotificationFilters = {},
) {
  const where: Prisma.NotificationWhereInput = { userId };
  if (filters.isRead !== undefined) where.isRead = filters.isRead;
  if (filters.type) where.type = filters.type;

  const [total, items, unreadCount] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { items, total, unreadCount };
}

export async function markNotificationsRead(
  userId: string,
  input: MarkNotificationsInput,
) {
  if (input.all) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: result.count };
  }

  if (!input.ids?.length) {
    return { updatedCount: 0 };
  }

  const result = await prisma.notification.updateMany({
    where: { userId, id: { in: input.ids } },
    data: { isRead: true },
  });
  return { updatedCount: result.count };
}

export async function getNotificationById(id: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });
  if (!notification) throw notFound("Notification not found");
  return notification;
}

/** Poll helper for SSE stream — returns unread since a timestamp. */
export async function listNotificationsSince(
  userId: string,
  since: Date,
  take = 50,
) {
  return prisma.notification.findMany({
    where: {
      userId,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}
