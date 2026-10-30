import { z } from "zod";

export const cuidSchema = z.string().cuid();

/**
 * Accepts Prisma cuid() values and fixed seed ids (e.g. "default-pipeline").
 * Use for FKs that may come from seeded system rows, not only user-created cuids.
 */
export const entityIdSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid id");

export const optionalCuid = z.preprocess(
  (v) => (v === "" ? null : v),
  z.string().cuid().nullable().optional(),
);

export const optionalEntityId = z.preprocess(
  (v) => (v === "" ? null : v),
  entityIdSchema.nullable().optional(),
);

export const emptyToNull = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null || v.trim() === "" ? null : v.trim()));

export const optionalEmail = z
  .string()
  .email()
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const optionalUrl = z
  .string()
  .url()
  .optional()
  .nullable()
  .or(z.literal("").transform(() => null));

export const optionalDate = z.coerce.date().optional().nullable();

export const optionalDecimal = z.coerce
  .number()
  .finite()
  .optional()
  .nullable();

export const idsSchema = z.object({
  ids: z.array(cuidSchema).min(1).max(500),
});

export const dateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export function parseJsonBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  return schema.parse(body);
}

export function searchParamsObject(searchParams: URLSearchParams) {
  const obj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}
