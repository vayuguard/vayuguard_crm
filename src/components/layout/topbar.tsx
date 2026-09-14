"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUiStore } from "@/stores/ui-store";
import { apiFetch } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import {
  enableDeviceNotifications,
  getDeviceNotificationState,
  type DeviceNotificationState,
} from "@/lib/push-client";

type Notification = {
  id: string;
  title: string;
  body?: string | null;
  type?: string;
  isRead?: boolean;
  createdAt?: string;
  link?: string | null;
  href?: string | null;
};

type NotificationsPayload = {
  items: Notification[];
  unreadCount: number;
};

function showBrowserNotification(n: {
  title: string;
  body?: string | null;
  link?: string | null;
}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  // Prefer OS toast when the CRM tab is in the background or closed focus.
  if (!document.hidden && document.hasFocus()) return;

  try {
    const note = new Notification(n.title, {
      body: n.body ?? undefined,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: `crm-${n.title}`,
      data: { url: n.link || "/" },
    });
    note.onclick = () => {
      window.focus();
      if (n.link) window.location.href = n.link;
      note.close();
    };
  } catch {
    // Safari private mode / unsupported — ignore
  }
}

export function Topbar() {
  const router = useRouter();
  const { data: session } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const queryClient = useQueryClient();
  const user = session?.user;
  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    "VG";

  const [pushState, setPushState] = React.useState<DeviceNotificationState>(
    "unsupported",
  );
  const [enablingPush, setEnablingPush] = React.useState(false);

  React.useEffect(() => {
    setPushState(getDeviceNotificationState());
  }, []);

  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiFetch<NotificationsPayload>("/api/notifications");
      return res.data;
    },
    refetchInterval: 60_000,
  });

  // SSE live updates + device toast when the tab is in the background
  React.useEffect(() => {
    let source: EventSource | null = null;

    try {
      source = new EventSource("/api/notifications/stream");
      source.addEventListener("notifications", (event) => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        try {
          const payload = JSON.parse(
            (event as MessageEvent).data as string,
          ) as Notification[] | { items?: Notification[] };
          const items = Array.isArray(payload)
            ? payload
            : (payload.items ?? []);
          for (const item of items) {
            showBrowserNotification({
              title: item.title,
              body: item.body,
              link: item.link ?? item.href,
            });
          }
        } catch {
          // payload may be a simple ping
        }
      });
      source.onerror = () => {
        source?.close();
        source = null;
      };
    } catch {
      // EventSource unavailable — poll interval handles updates
    }

    return () => {
      source?.close();
    };
  }, [queryClient]);

  const markReadMutation = useMutation({
    mutationFn: async (payload: { ids?: string[]; all?: boolean }) =>
      apiFetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleEnableDeviceAlerts() {
    setEnablingPush(true);
    try {
      const result = await enableDeviceNotifications();
      setPushState(result.state);
      if (result.state === "granted") {
        toast.success(
          "Device alerts enabled. You will get notifications even when this tab is closed.",
        );
      } else if (result.state === "denied") {
        toast.error(
          "Notifications are blocked. Allow them in the browser address-bar permissions.",
        );
      } else if (result.message) {
        toast.error(result.message);
      }
    } finally {
      setEnablingPush(false);
    }
  }

  const unread = notificationsQuery.data?.unreadCount ?? 0;
  const notifications = notificationsQuery.data?.items ?? [];

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandPaletteOpen]);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:gap-3 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 md:hidden"
        aria-label="Open menu"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="size-4" />
      </Button>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className={cn(
          "flex h-8 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted",
        )}
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">Search modules, records…</span>
        <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        {pushState !== "granted" && pushState !== "unsupported" ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Enable device alerts"
            title="Enable device alerts"
            disabled={enablingPush}
            onClick={() => void handleEnableDeviceAlerts()}
          >
            <BellRing className="size-4" />
          </Button>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="relative"
              />
            }
          >
            <Bell className="size-4" />
            {unread > 0 ? (
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
            ) : null}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between gap-2 font-normal">
              <span className="text-sm font-medium">Notifications</span>
              {unread > 0 ? (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => markReadMutation.mutate({ all: true })}
                >
                  Mark all read
                </button>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {pushState !== "granted" ? (
              <>
                <DropdownMenuItem
                  disabled={enablingPush || pushState === "unsupported"}
                  onClick={() => void handleEnableDeviceAlerts()}
                >
                  <BellRing className="size-4" />
                  {pushState === "denied"
                    ? "Notifications blocked in browser"
                    : enablingPush
                      ? "Enabling device alerts…"
                      : "Enable device alerts"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            {notificationsQuery.isLoading ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 8).map((n) => {
                const target = n.link ?? n.href ?? null;
                return (
                  <DropdownMenuItem
                    key={n.id}
                    className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
                    onClick={() => {
                      if (!n.isRead) {
                        markReadMutation.mutate({ ids: [n.id] });
                      }
                      if (target) router.push(target);
                    }}
                  >
                    <span
                      className={cn(
                        "text-sm",
                        !n.isRead && "font-medium text-foreground",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.body ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(n.createdAt, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          className="relative"
          onClick={() =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark")
          }
        >
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" />
            }
          >
            <Avatar size="sm">
              {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{user?.name ?? "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <User className="size-4" />
              Profile & settings
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={enablingPush || pushState === "unsupported"}
              onClick={() => void handleEnableDeviceAlerts()}
            >
              <BellRing className="size-4" />
              {pushState === "granted"
                ? "Device alerts on"
                : "Enable device alerts"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
