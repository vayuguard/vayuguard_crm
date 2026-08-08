import { NextRequest } from "next/server";
import { z } from "zod";
import slugify from "slugify";
import { ok, created, fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import {
  cuidSchema,
  emptyToNull,
} from "@/lib/validators/common";
import { getClientIp } from "@/server/api/rate-limit";

const stageInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional().default(0),
  position: z.coerce.number().int().min(0).optional(),
  color: emptyToNull,
  isWon: z.boolean().optional().default(false),
  isLost: z.boolean().optional().default(false),
});

const createPipelineSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: emptyToNull,
  isDefault: z.boolean().optional().default(false),
  stages: z.array(stageInputSchema).min(1).optional(),
});

const createStageSchema = stageInputSchema.extend({
  pipelineId: cuidSchema,
  action: z.literal("stage").optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission("deals:read");
    const includeDeleted =
      request.nextUrl.searchParams.get("includeDeleted") === "true";

    const pipelines = await prisma.pipeline.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      include: {
        stages: { orderBy: { position: "asc" } },
        _count: { select: { deals: true } },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return ok(pipelines);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("deals:write");
    const body = await request.json();
    const action = (body as { action?: string }).action ?? "pipeline";

    if (action === "stage") {
      const input = createStageSchema.parse(body);
      const pipeline = await prisma.pipeline.findFirst({
        where: { id: input.pipelineId, deletedAt: null },
        include: { stages: true },
      });
      if (!pipeline) throw notFound("Pipeline not found");

      const slug =
        input.slug ??
        (slugify(input.name, { lower: true, strict: true }) ||
          `stage-${pipeline.stages.length + 1}`);

      const stage = await prisma.pipelineStage.create({
        data: {
          pipelineId: input.pipelineId,
          name: input.name,
          slug,
          probability: input.probability ?? 0,
          position: input.position ?? pipeline.stages.length,
          color: input.color ?? "#0d9488",
          isWon: input.isWon ?? false,
          isLost: input.isLost ?? false,
        },
      });

      await writeAuditLog({
        action: "PIPELINE_STAGE_CREATE",
        entityType: "PipelineStage",
        entityId: stage.id,
        userId: session.user.id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent"),
        metadata: { pipelineId: input.pipelineId, name: stage.name },
      });

      return created(stage);
    }

    const input = createPipelineSchema.parse(body);
    type StageDraft = {
      name: string;
      slug?: string;
      probability?: number;
      position?: number;
      color?: string | null;
      isWon?: boolean;
      isLost?: boolean;
    };
    const defaultStages: StageDraft[] = input.stages ?? [
      { name: "New", probability: 10, position: 0, isWon: false, isLost: false },
      {
        name: "Qualified",
        probability: 30,
        position: 1,
        isWon: false,
        isLost: false,
      },
      {
        name: "Proposal",
        probability: 50,
        position: 2,
        isWon: false,
        isLost: false,
      },
      {
        name: "Negotiation",
        probability: 70,
        position: 3,
        isWon: false,
        isLost: false,
      },
      { name: "Won", probability: 100, position: 4, isWon: true, isLost: false },
      { name: "Lost", probability: 0, position: 5, isWon: false, isLost: true },
    ];

    if (input.isDefault) {
      await prisma.pipeline.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        stages: {
          create: defaultStages.map((stage, index) => {
            const name = stage.name;
            const slug =
              stage.slug ??
              (slugify(name, { lower: true, strict: true }) ||
                `stage-${index + 1}`);
            return {
              name,
              slug,
              probability: stage.probability ?? 0,
              position: stage.position ?? index,
              color: stage.color ?? "#0d9488",
              isWon: stage.isWon ?? false,
              isLost: stage.isLost ?? false,
            };
          }),
        },
      },
      include: {
        stages: { orderBy: { position: "asc" } },
      },
    });

    await writeAuditLog({
      action: "PIPELINE_CREATE",
      entityType: "Pipeline",
      entityId: pipeline.id,
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: { name: pipeline.name },
    });

    return created(pipeline);
  } catch (error) {
    return fail(error);
  }
}
