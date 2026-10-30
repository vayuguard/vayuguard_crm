import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

type Person = { name?: string | null; email?: string | null } | null | undefined;

function displayName(person: Person) {
  return person?.name?.trim() || person?.email || null;
}

/** "Handled by" tag so everyone can see who is working on a record. */
export function OwnerBadge({
  person,
  label = "Handled by",
  compact = false,
  className,
}: {
  person: Person;
  label?: string;
  /** Hide the label and show only the name (for dense tables). */
  compact?: boolean;
  className?: string;
}) {
  const name = displayName(person);

  if (!name) {
    return (
      <span
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-xs font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
          className,
        )}
      >
        <UserRound className="size-3" />
        Unassigned
      </span>
    );
  }

  return (
    <span
      title={`${label}: ${name}`}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 text-xs font-medium text-foreground",
        className,
      )}
    >
      <UserRound className="size-3 shrink-0 text-primary" />
      {!compact ? (
        <span className="text-muted-foreground">{label}:</span>
      ) : null}
      <span className="truncate">{name}</span>
    </span>
  );
}
