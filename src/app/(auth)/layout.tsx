import Link from "next/link";
import { Wind } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/40 to-slate-100 px-4 dark:from-slate-950 dark:via-teal-950/30 dark:to-slate-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, oklch(0.6 0.118 185 / 0.15), transparent 45%), radial-gradient(circle at 80% 80%, oklch(0.55 0.08 230 / 0.12), transparent 40%)",
        }}
      />
      <div className="relative z-10 mb-8 flex flex-col items-center gap-3">
        <Link
          href="/login"
          className="flex items-center gap-2.5 text-foreground"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Wind className="size-5" />
          </span>
          <span className="text-2xl font-semibold tracking-tight">
            VayuGuard
          </span>
        </Link>
        <p className="text-sm text-muted-foreground">
          CRM for modern sales & operations teams
        </p>
      </div>
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
