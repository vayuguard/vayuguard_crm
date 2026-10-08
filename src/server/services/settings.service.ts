import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db/client";
import { notFound } from "@/server/api/errors";
import { emptyToNull, optionalUrl } from "@/lib/validators/common";
import { PERMISSIONS } from "@/lib/permissions";

export const updateCompanySettingsSchema = z.object({
  companyName: z.string().trim().min(1).max(200).optional(),
  logoUrl: optionalUrl,
  brandPrimary: z.string().trim().min(1).max(40).optional(),
  brandSecondary: z.string().trim().min(1).max(40).optional(),
  gstNumber: emptyToNull,
  panNumber: emptyToNull,
  address: emptyToNull,
  email: emptyToNull,
  phone: emptyToNull,
  currency: z.string().trim().min(1).max(10).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  emailSettings: z.record(z.unknown()).optional().nullable(),
  smsSettings: z.record(z.unknown()).optional().nullable(),
  whatsappSettings: z.record(z.unknown()).optional().nullable(),
  featureFlags: z.record(z.unknown()).optional().nullable(),
});

export const updateRolePermissionsSchema = z.object({
  roleId: z.string().cuid(),
  permissionKeys: z.array(z.string()).min(0),
});

export type UpdateCompanySettingsInput = z.infer<
  typeof updateCompanySettingsSchema
>;
export type UpdateRolePermissionsInput = z.infer<
  typeof updateRolePermissionsSchema
>;

export async function getCompanySettings() {
  const existing = await prisma.companySettings.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.companySettings.create({
    data: { companyName: "VayuCrm" },
  });
}

export async function updateCompanySettings(input: UpdateCompanySettingsInput) {
  const current = await getCompanySettings();
  return prisma.companySettings.update({
    where: { id: current.id },
    data: {
      companyName: input.companyName,
      logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl,
      brandPrimary: input.brandPrimary,
      brandSecondary: input.brandSecondary,
      gstNumber: input.gstNumber === undefined ? undefined : input.gstNumber,
      panNumber: input.panNumber === undefined ? undefined : input.panNumber,
      address: input.address === undefined ? undefined : input.address,
      email: input.email === undefined ? undefined : input.email,
      phone: input.phone === undefined ? undefined : input.phone,
      currency: input.currency,
      timezone: input.timezone,
      emailSettings:
        input.emailSettings === undefined
          ? undefined
          : ((input.emailSettings ??
              Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull),
      smsSettings:
        input.smsSettings === undefined
          ? undefined
          : ((input.smsSettings ??
              Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull),
      whatsappSettings:
        input.whatsappSettings === undefined
          ? undefined
          : ((input.whatsappSettings ??
              Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull),
      featureFlags:
        input.featureFlags === undefined
          ? undefined
          : ((input.featureFlags ??
              Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull),
    },
  });
}

export async function listRolesWithPermissions() {
  const roles = await prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });

  return {
    roles: roles.map((role) => ({
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.permissions.map((rp) => rp.permission.key),
    })),
    availablePermissions: PERMISSIONS,
  };
}

export async function updateRolePermissions(input: UpdateRolePermissionsInput) {
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw notFound("Role not found");

  const permissions = await prisma.permission.findMany({
    where: { key: { in: input.permissionKeys } },
    select: { id: true, key: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissions.length) {
      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({
          roleId: role.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });
    }
  });

  return listRolesWithPermissions();
}

export const createCustomFieldSchema = z.object({
  module: z.string().trim().min(1).max(80),
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Use letters, numbers, underscore"),
  label: z.string().trim().min(1).max(120),
  fieldType: z
    .enum(["text", "number", "date", "boolean", "select", "textarea"])
    .default("text"),
  options: z.array(z.string()).optional().nullable(),
  isRequired: z.boolean().optional().default(false),
  position: z.coerce.number().int().min(0).optional().default(0),
});

export type CreateCustomFieldInput = z.infer<typeof createCustomFieldSchema>;

export async function listCustomFields(module?: string) {
  return prisma.customFieldDefinition.findMany({
    where: module ? { module } : undefined,
    orderBy: [{ module: "asc" }, { position: "asc" }, { label: "asc" }],
  });
}

export async function createCustomField(input: CreateCustomFieldInput) {
  return prisma.customFieldDefinition.create({
    data: {
      module: input.module,
      fieldKey: input.fieldKey,
      label: input.label,
      fieldType: input.fieldType,
      options:
        input.options === undefined || input.options === null
          ? undefined
          : (input.options as Prisma.InputJsonValue),
      isRequired: input.isRequired ?? false,
      position: input.position ?? 0,
    },
  });
}
