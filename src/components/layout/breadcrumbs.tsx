"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const TITLE_MAP = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.href.replace(/^\//, ""), item.title]),
);

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label =
      TITLE_MAP[segment] ??
      segment
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = index === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("mb-4 flex items-center gap-1 text-sm", className)}
    >
      <Link
        href="/dashboard"
        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Home className="size-3.5" />
        <span className="sr-only">Home</span>
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
