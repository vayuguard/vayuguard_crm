/**
 * Client helpers for browser Notification permission + Web Push subscription.
 * Works over HTTPS (or localhost). Requires VAPID keys on the server.
 */

export type DeviceNotificationState =
  | "unsupported"
  | "default"
  | "denied"
  | "granted"
  | "missing-vapid";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function getDeviceNotificationState(): DeviceNotificationState {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  return Notification.permission as "default" | "denied" | "granted";
}

export async function enableDeviceNotifications(): Promise<{
  state: DeviceNotificationState;
  message?: string;
}> {
  if (typeof window === "undefined") {
    return { state: "unsupported", message: "Not available on the server." };
  }
  if (!("Notification" in window)) {
    return {
      state: "unsupported",
      message: "This browser does not support notifications.",
    };
  }
  if (!window.isSecureContext) {
    return {
      state: "unsupported",
      message: "Device alerts require HTTPS.",
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      state: permission === "denied" ? "denied" : "default",
      message: "Notification permission was not granted.",
    };
  }

  // Local OS toast works even without Web Push; push needs VAPID + SW.
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return {
      state: "granted",
      message:
        "Browser alerts enabled for this tab. Background push is unavailable in this browser.",
    };
  }

  try {
    const keyRes = await fetch("/api/push/vapid-public-key");
    const keyJson = (await keyRes.json()) as {
      data?: { publicKey?: string | null; configured?: boolean };
      error?: { message?: string } | null;
    };
    const publicKey = keyJson.data?.publicKey;
    if (!publicKey) {
      return {
        state: "missing-vapid",
        message:
          "Server push keys are not configured yet. Local alerts still work while the CRM tab is open in the background.",
      };
    }

    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return {
        state: "granted",
        message: "Could not read push subscription keys.",
      };
    }

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      }),
    });

    return { state: "granted" };
  } catch (error) {
    return {
      state: "granted",
      message:
        error instanceof Error
          ? error.message
          : "Could not register background push.",
    };
  }
}
