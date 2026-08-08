"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type FilterBarProps = {
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
};

export function FilterBar({ children, className, actions }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
