import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VayuCrm",
    template: "%s · VayuCrm",
  },
  description:
    "VayuCrm by vayuguard — sales, customers, pipeline, and operations in one place.",
  icons: {
    icon: [{ url: "/vayuCrm.png", type: "image/png" }],
    shortcut: "/vayuCrm.png",
    apple: "/vayuCrm.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${geistMono.variable} min-h-svh font-sans antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
