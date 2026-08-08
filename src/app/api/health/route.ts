import { ok } from "@/server/api/response";
import { prisma } from "@/server/db/client";

export async function GET() {
  let database: "up" | "down" = "up";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "down";
  }

  const healthy = database === "up";

  return ok(
    {
      status: healthy ? "ok" : "degraded",
      service: "vayuguard-crm",
      database,
      timestamp: new Date().toISOString(),
    },
    undefined,
    { status: healthy ? 200 : 503 },
  );
}
