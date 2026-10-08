"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/brand/brand-mark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[radial-gradient(1200px_600px_at_10%_-10%,oklch(0.92_0.04_185),transparent),radial-gradient(900px_500px_at_90%_110%,oklch(0.93_0.03_230),transparent),linear-gradient(160deg,oklch(0.985_0.005_247),oklch(0.96_0.02_185))] px-4 dark:bg-[radial-gradient(1000px_500px_at_15%_0%,oklch(0.28_0.05_185/0.45),transparent),radial-gradient(800px_400px_at_85%_100%,oklch(0.25_0.04_230/0.35),transparent),linear-gradient(160deg,oklch(0.16_0.02_250),oklch(0.18_0.03_185))]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10"
        animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.06, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] bottom-[-10%] size-[380px] rounded-full bg-slate-400/15 blur-3xl dark:bg-slate-500/10"
        animate={{ opacity: [0.25, 0.45, 0.25], x: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative z-10 mb-10 flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }}
      >
        <Link
          href="/login"
          className="group text-foreground transition-transform duration-300 hover:scale-[1.02]"
        >
          <BrandMark size={48} titleClassName="text-3xl" />
        </Link>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          CRM for modern sales & operations teams
        </p>
      </motion.div>

      <div className="relative z-10 w-full max-w-[420px]">{children}</div>
    </div>
  );
}
