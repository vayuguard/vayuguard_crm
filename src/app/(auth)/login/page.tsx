"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, type Variants } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.12 + i * 0.08,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const [submitting, setSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
        return;
      }

      toast.success("Welcome back");
      router.push(callbackUrl);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <Card className="overflow-hidden border-border/50 bg-card/90 shadow-xl shadow-teal-950/10 backdrop-blur-md dark:shadow-black/40">
        <CardHeader className="space-y-2 pb-2">
          <CardTitle className="text-2xl tracking-tight">Sign in</CardTitle>
          <CardDescription className="text-[15px] leading-relaxed">
            Access your VayuGuard workspace securely
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-5 pt-4 pb-2">
            <motion.div
              className="space-y-2"
              custom={0}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
            >
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className="h-11 pl-10 transition-shadow focus-visible:shadow-[0_0_0_3px_oklch(0.6_0.118_185/0.2)]"
                  placeholder="you@company.com"
                  {...form.register("email")}
                />
              </div>
              {form.formState.errors.email ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive"
                >
                  {form.formState.errors.email.message}
                </motion.p>
              ) : null}
            </motion.div>

            <motion.div
              className="space-y-2"
              custom={1}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
            >
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="h-11 pr-10 pl-10 transition-shadow focus-visible:shadow-[0_0_0_3px_oklch(0.6_0.118_185/0.2)]"
                  placeholder="Enter your password"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive"
                >
                  {form.formState.errors.password.message}
                </motion.p>
              ) : null}
            </motion.div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 pt-6 pb-6">
            <motion.div
              className="w-full"
              custom={2}
              variants={fieldVariants}
              initial="hidden"
              animate="visible"
            >
              <Button
                type="submit"
                className="h-11 w-full text-[15px] font-medium transition-transform active:scale-[0.98]"
                size="lg"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </motion.div>
            <p className="text-center text-xs text-muted-foreground">
              Use the account issued by your administrator
            </p>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <Card className="border-border/50 bg-card/90 backdrop-blur-md">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Loading…</CardDescription>
          </CardHeader>
        </Card>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
