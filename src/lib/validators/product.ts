import { z } from "zod";
import {
  cuidSchema,
  emptyToNull,
  optionalCuid,
} from "./common";

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(200),
  description: emptyToNull,
  price: z.coerce.number().finite().min(0),
  gstPercent: z.coerce.number().finite().min(0).max(100).optional().default(18),
  categoryId: optionalCuid,
  /** Category name — resolved to ProductCategory (create if missing) when categoryId omitted */
  category: emptyToNull,
  inventory: z.coerce.number().int().min(0).optional().default(0),
  images: z.array(z.string().url()).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const productFiltersSchema = z.object({
  categoryId: cuidSchema.optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
