import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsView } from "@/features/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile, permissions, and organization preferences."
      />
      <SettingsView />
    </>
  );
}
