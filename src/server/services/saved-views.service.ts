import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";

export const createSavedViewSchema = z.object({
  name: z.string().trim().min(1).max(120),
  module: z.string().trim().min(1).max(80),
  filters: z.record(z.unknown()).default({}),
  columns: z.array(z.string()).optional().nullable(),
  sort: z.record(z.unknown()).optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  isShared: z.boolean().optional().default(false),
});

export const updateSavedViewSchema = createSavedViewSchema.partial();

export const savedViewFiltersSchema = z.object({
  module: z.string().optional(),
  pinned: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;
export type SavedViewFilters = z.infer<typeof savedViewFiltersSchema>;

export async function listSavedViews(
  userId: string,
  pagination: PaginationInput,
  filters: SavedViewFilters = {},
) {
  const where: Prisma.SavedViewWhereInput = {
    OR: [{ userId }, { isShared: true }],
  };
  if (filters.module) where.module = filters.module;
  if (filters.pinned !== undefined) where.isPinned = filters.pinned;
  if (pagination.q?.trim()) {
    where.name = { contains: pagination.q.trim(), mode: "insensitive" };
  }

  const [total, items] = await Promise.all([
    prisma.savedView.count({ where }),
    prisma.savedView.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);

  return { items, total };
}

export async function getSavedViewById(id: string, userId: string) {
  const view = await prisma.savedView.findFirst({
    where: {
      id,
      OR: [{ userId }, { isShared: true }],
    },
  });
  if (!view) throw notFound("Saved view not found");
  return view;
}

export async function createSavedView(
  input: CreateSavedViewInput,
  userId: string,
) {
  return prisma.savedView.create({
    data: {
      name: input.name,
      module: input.module,
      filters: input.filters as Prisma.InputJsonValue,
      columns: (input.columns ?? undefined) as Prisma.InputJsonValue | undefined,
      sort: (input.sort ?? undefined) as Prisma.InputJsonValue | undefined,
      isPinned: input.isPinned ?? false,
      isShared: input.isShared ?? false,
      userId,
    },
  });
}

export async function updateSavedView(
  id: string,
  input: UpdateSavedViewInput,
  userId: string,
) {
  const existing = await prisma.savedView.findFirst({
    where: { id, userId },
  });
  if (!existing) throw notFound("Saved view not found");

  return prisma.savedView.update({
    where: { id },
    data: {
      name: input.name,
      module: input.module,
      filters:
        input.filters === undefined
          ? undefined
          : (input.filters as Prisma.InputJsonValue),
      columns:
        input.columns === undefined
          ? undefined
          : ((input.columns ??
              Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull),
      sort:
        input.sort === undefined
          ? undefined
          : ((input.sort ??
              Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull),
      isPinned: input.isPinned,
      isShared: input.isShared,
    },
  });
}

export async function deleteSavedView(id: string, userId: string) {
  const existing = await prisma.savedView.findFirst({
    where: { id, userId },
  });
  if (!existing) throw notFound("Saved view not found");
  return prisma.savedView.delete({ where: { id } });
}
