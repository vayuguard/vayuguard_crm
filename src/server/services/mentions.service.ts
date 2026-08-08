import { NotificationType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { createNotification } from "@/server/services/notifications.service";

const MENTION_RE = /@([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?|[a-zA-Z][a-zA-Z0-9._-]{1,40})/g;

/**
 * Parse @mentions from free text and create Mention rows + MENTION notifications.
 * Supports @email and @FirstName / @username matching against User.email or User.name.
 */
export async function processMentions(options: {
  text: string | null | undefined;
  authorId: string;
  entityType: string;
  entityId: string;
  link?: string | null;
}) {
  const text = options.text?.trim();
  if (!text) return [];

  const tokens = new Set<string>();
  for (const match of text.matchAll(MENTION_RE)) {
    const token = match[1]?.trim();
    if (token) tokens.add(token.toLowerCase());
  }
  if (!tokens.size) return [];

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { email: { in: [...tokens], mode: "insensitive" } },
        {
          name: {
            in: [...tokens].map((t) => t.replace(/[._]/g, " ")),
            mode: "insensitive",
          },
        },
        ...[...tokens].map((t) => ({
          name: { contains: t.replace(/[._]/g, " "), mode: "insensitive" as const },
        })),
      ],
    },
    select: { id: true, name: true, email: true },
    take: 20,
  });

  const created = [];
  const seen = new Set<string>();

  for (const user of users) {
    if (user.id === options.authorId || seen.has(user.id)) continue;
    const emailMatch = user.email && tokens.has(user.email.toLowerCase());
    const nameParts = (user.name ?? "").toLowerCase().split(/\s+/);
    const nameMatch = nameParts.some((p) => tokens.has(p)) ||
      tokens.has((user.name ?? "").toLowerCase().replace(/\s+/g, "."));
    if (!emailMatch && !nameMatch) continue;

    seen.add(user.id);
    const mention = await prisma.mention.create({
      data: {
        mentionedUserId: user.id,
        authorId: options.authorId,
        entityType: options.entityType,
        entityId: options.entityId,
        snippet: text.slice(0, 240),
      },
    });

    await createNotification({
      userId: user.id,
      type: NotificationType.MENTION,
      title: "You were mentioned",
      body: text.slice(0, 180),
      link: options.link ?? null,
      metadata: {
        entityType: options.entityType,
        entityId: options.entityId,
        mentionId: mention.id,
      },
    });

    created.push(mention);
  }

  return created;
}
