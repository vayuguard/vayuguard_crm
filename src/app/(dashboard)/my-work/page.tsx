import type { Metadata } from "next";
import { MyWorkView } from "@/features/my-work/my-work-view";

export const metadata: Metadata = { title: "My work" };

export default function MyWorkPage() {
  return <MyWorkView />;
}
