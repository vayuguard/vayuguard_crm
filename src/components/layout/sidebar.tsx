"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { useUiStore } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function useNavItems() {
  const { can, isLoading } = usePermissions();
  const items = NAV_ITEMS.filter(
    (item) => !item.permission || can(item.permission),
  );
  return { items, isLoading };
}

function NavLinks({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { items, isLoading } = useNavItems();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="mx-1 h-8 animate-pulse rounded-lg bg-muted/60"
          />
        ))}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const className = cn(
          "group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        );

        const content = (
          <>
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-primary" : "opacity-80",
              )}
            />
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="truncate"
                >
                  {item.title}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </>
        );

        if (!collapsed) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={className}
              onClick={onNavigate}
            >
              {content}
            </Link>
          );
        }

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger
              render={
                <Link
                  href={item.href}
                  className={className}
                  onClick={onNavigate}
                />
              }
            >
              {content}
            </TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar — hidden below md; collapse toggle for dense Super Admin menus. */
export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <TooltipProvider delay={200}>
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 68 : 240 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="relative z-30 hidden h-svh min-h-0 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Wind className="size-4" />
            </span>
            <AnimatePresence initial={false}>
              {!sidebarCollapsed ? (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  className="truncate text-sm font-semibold tracking-tight"
                >
                  VayuGuard
                </motion.span>
              ) : null}
            </AnimatePresence>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
          <NavLinks collapsed={sidebarCollapsed} />
        </div>

        {!sidebarCollapsed ? (
          <div className="border-t border-sidebar-border p-3">
            <p className="px-1 text-[11px] text-muted-foreground">
              VayuGuard CRM · v0.1
            </p>
          </div>
        ) : null}
      </motion.aside>
    </TooltipProvider>
  );
}

/** Mobile off-canvas navigation (Sheet). Controlled from the Topbar hamburger. */
export function MobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetContent
        side="left"
        showCloseButton
        className="w-[min(100%,20rem)] gap-0 bg-sidebar p-0 text-sidebar-foreground md:hidden"
      >
        <SheetHeader className="border-b border-sidebar-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2.5 text-sidebar-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Wind className="size-4" />
            </span>
            VayuGuard
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100svh-3.5rem)] overflow-y-auto overscroll-contain px-2 py-3">
          <NavLinks
            collapsed={false}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
