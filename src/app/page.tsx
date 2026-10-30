import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { homePathForRole } from "@/lib/navigation";

export default async function HomePage() {
  const session = await auth();
  redirect(homePathForRole(session?.user?.role));
}
