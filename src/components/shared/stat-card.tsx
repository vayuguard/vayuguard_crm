import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    positive?: boolean;
  };
  className?: string;
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-4", className)}>
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {title}
            </p>
            <p className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
            {trend ? (
              <p
                className={cn(
                  "text-xs font-medium",
                  trend.positive === false
                    ? "text-destructive"
                    : "text-teal-700 dark:text-teal-400",
                )}
              >
                {trend.value}
              </p>
            ) : null}
          </div>
          {Icon ? (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
