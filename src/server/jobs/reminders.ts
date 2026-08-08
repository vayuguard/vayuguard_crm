import { NotificationType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { createNotification } from "@/server/services/notifications.service";

/**
 * Process due reminders: mark sent and create in-app notifications.
 * Safe to call from a cron / queued worker.
 */
export async function processDueReminders(now = new Date()) {
  const due = await prisma.reminder.findMany({
    where: {
      isSent: false,
      remindAt: { lte: now },
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          assignedToId: true,
        },
      },
    },
    take: 200,
    orderBy: { remindAt: "asc" },
  });

  let processed = 0;
  let notified = 0;

  for (const reminder of due) {
    const userId = reminder.userId ?? reminder.task?.assignedToId ?? null;

    await prisma.reminder.update({
      where: { id: reminder.id },
      data: { isSent: true },
    });
    processed += 1;

    if (userId) {
      await createNotification({
        userId,
        type: NotificationType.TASK_REMINDER,
        title: reminder.title,
        body: reminder.task
          ? `Reminder for task: ${reminder.task.title}`
          : "You have a due reminder",
        link: reminder.taskId ? `/tasks?id=${reminder.taskId}` : null,
        metadata: {
          reminderId: reminder.id,
          channel: reminder.channel,
          taskId: reminder.taskId,
        },
      });
      notified += 1;
    }
  }

  return { processed, notified, checkedAt: now.toISOString() };
}
