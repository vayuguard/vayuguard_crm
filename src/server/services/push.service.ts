import webpush from "web-push";
import { prisma } from "@/server/db/client";

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "mailto:admin@vayuguard.com";

  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

let configured = false;

function ensureWebPushConfigured() {
  if (configured) return true;
  const config = getVapidConfig();
  if (!config) return false;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  configured = true;
  return true;
}

export function getVapidPublicKey() {
  return getVapidConfig()?.publicKey ?? null;
}

export function isWebPushConfigured() {
  return Boolean(getVapidConfig());
}

export async function saveWebPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  return prisma.webPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? undefined,
    },
    update: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? undefined,
    },
  });
}

export async function removeWebPushSubscription(
  userId: string,
  endpoint: string,
) {
  return prisma.webPushSubscription.deleteMany({
    where: { userId, endpoint },
  });
}

export async function sendWebPushToUser(
  userId: string,
  payload: {
    title: string;
    body?: string | null;
    link?: string | null;
    tag?: string;
  },
) {
  if (!ensureWebPushConfigured()) return { sent: 0, removed: 0 };

  const subscriptions = await prisma.webPushSubscription.findMany({
    where: { userId },
  });
  if (!subscriptions.length) return { sent: 0, removed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.link || "/",
    tag: payload.tag ?? `vayuguard-${Date.now()}`,
  });

  let sent = 0;
  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        const status =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;
        // Gone / unauthorized → drop the subscription
        if (status === 404 || status === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }),
  );

  if (staleEndpoints.length) {
    await prisma.webPushSubscription.deleteMany({
      where: { endpoint: { in: staleEndpoints } },
    });
  }

  return { sent, removed: staleEndpoints.length };
}
