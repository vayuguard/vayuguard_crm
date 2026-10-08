import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  /** Show wordmark + “by vayuguard” */
  showText?: boolean;
  /** Compact stack for narrow headers */
  className?: string;
  /** Logo box size in px */
  size?: number;
  /** Title text size classes */
  titleClassName?: string;
};

export function BrandMark({
  showText = true,
  className,
  size = 32,
  titleClassName,
}: BrandMarkProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className="relative shrink-0 overflow-hidden rounded-lg bg-white/90 shadow-sm ring-1 ring-border/60 dark:bg-white/10"
        style={{ width: size, height: size }}
      >
        <Image
          src="/vayuCrm.png"
          alt="VayuCrm"
          fill
          sizes={`${size}px`}
          className="object-contain p-0.5"
          priority
        />
      </span>
      {showText ? (
        <span className="flex min-w-0 flex-col leading-tight">
          <span
            className={cn(
              "truncate font-semibold tracking-tight",
              titleClassName ?? "text-sm",
            )}
          >
            VayuCrm
          </span>
          <span className="truncate text-[10px] font-normal text-muted-foreground">
            by vayuguard
          </span>
        </span>
      ) : null}
    </span>
  );
}
