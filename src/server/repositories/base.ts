import type { Prisma } from "@prisma/client";

export type ListParams = {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
};

export function softDeleteWhere<T extends Record<string, unknown>>(
  where: T = {} as T,
): T & { deletedAt: null } {
  return { ...where, deletedAt: null };
}

export function paginationArgs(params: ListParams) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function sortArgs(
  sort: string | undefined,
  order: "asc" | "desc" = "desc",
  allowed: string[] = ["createdAt", "updatedAt", "name"],
): Record<string, Prisma.SortOrder> {
  const field = sort && allowed.includes(sort) ? sort : "createdAt";
  return { [field]: order };
}

export function auditCreateFields(userId?: string | null) {
  return {
    createdById: userId ?? undefined,
    updatedById: userId ?? undefined,
  };
}

export function auditUpdateFields(userId?: string | null) {
  return {
    updatedById: userId ?? undefined,
  };
}
