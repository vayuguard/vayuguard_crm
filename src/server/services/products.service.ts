import { type Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { notFound, validationError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import type {
  CreateProductInput,
  ProductFilters,
  UpdateProductInput,
} from "@/lib/validators/product";

const productInclude = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

function buildWhere(
  filters: ProductFilters,
  q?: string,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { deletedAt: null };
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listProducts(
  pagination: PaginationInput,
  filters: ProductFilters = {},
) {
  const where = buildWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { items, total };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: productInclude,
  });
  if (!product) throw notFound("Product not found");
  return product;
}

async function resolveCategoryId(
  categoryId?: string | null,
  categoryName?: string | null,
): Promise<string | null | undefined> {
  if (categoryId) return categoryId;
  if (categoryName == null) return categoryId;
  if (!categoryName.trim()) return null;
  const name = categoryName.trim();
  const existing = await prisma.productCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing.id;
  const created = await prisma.productCategory.create({ data: { name } });
  return created.id;
}

export async function createProduct(input: CreateProductInput, userId: string) {
  const existing = await prisma.product.findFirst({
    where: { sku: input.sku, deletedAt: null },
  });
  if (existing) throw validationError("SKU already exists");

  const { category, ...rest } = input;
  const categoryId = await resolveCategoryId(rest.categoryId, category);

  return prisma.product.create({
    data: {
      sku: rest.sku,
      name: rest.name,
      description: rest.description,
      price: rest.price,
      gstPercent: rest.gstPercent ?? 18,
      categoryId: categoryId ?? null,
      inventory: rest.inventory ?? 0,
      images: rest.images ?? [],
      isActive: rest.isActive ?? true,
      createdById: userId,
      updatedById: userId,
    },
    include: productInclude,
  });
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput,
  userId: string,
) {
  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Product not found");

  if (input.sku && input.sku !== existing.sku) {
    const dup = await prisma.product.findFirst({
      where: { sku: input.sku, deletedAt: null, id: { not: id } },
    });
    if (dup) throw validationError("SKU already exists");
  }

  const { category, ...rest } = input;
  const categoryId =
    category !== undefined || rest.categoryId !== undefined
      ? await resolveCategoryId(rest.categoryId, category)
      : undefined;

  return prisma.product.update({
    where: { id },
    data: {
      ...rest,
      ...(categoryId !== undefined ? { categoryId } : {}),
      updatedById: userId,
    },
    include: productInclude,
  });
}

export async function deleteProduct(id: string, userId: string) {
  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Product not found");

  return prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: userId, isActive: false },
  });
}
