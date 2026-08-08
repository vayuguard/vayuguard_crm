import {
  type LeadStatus,
  type Prisma,
  type Priority,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { notFound, validationError } from "@/server/api/errors";
import type { PaginationInput } from "@/server/api/pagination";
import type {
  BulkUpdateLeadsInput,
  CreateLeadActivityInput,
  CreateLeadAttachmentInput,
  CreateLeadInput,
  LeadFilters,
  MergeLeadsInput,
  UpdateLeadInput,
} from "@/lib/validators/lead";

const leadInclude = {
  assignedTo: { select: { id: true, name: true, email: true, image: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
  campaign: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, customerNumber: true } },
  tags: { include: { tag: true } },
  _count: {
    select: {
      activities: true,
      attachments: true,
      tasks: true,
      deals: true,
    },
  },
} satisfies Prisma.LeadInclude;

async function nextSequence(prefix: string, field: "leadNumber" | "customerNumber") {
  const latest =
    field === "leadNumber"
      ? await prisma.lead.findFirst({
          where: { leadNumber: { startsWith: prefix } },
          orderBy: { leadNumber: "desc" },
          select: { leadNumber: true },
        })
      : await prisma.customer.findFirst({
          where: { customerNumber: { startsWith: prefix } },
          orderBy: { customerNumber: "desc" },
          select: { customerNumber: true },
        });

  const current = latest
    ? Number(
        (field === "leadNumber"
          ? (latest as { leadNumber: string }).leadNumber
          : (latest as { customerNumber: string }).customerNumber
        ).slice(prefix.length),
      )
    : 0;

  return `${prefix}${String(current + 1).padStart(4, "0")}`;
}

export async function nextLeadNumber() {
  const year = new Date().getFullYear();
  return nextSequence(`LD-${year}-`, "leadNumber");
}

export async function nextCustomerNumber() {
  const year = new Date().getFullYear();
  return nextSequence(`CU-${year}-`, "customerNumber");
}

function buildLeadWhere(
  filters: LeadFilters,
  q?: string,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { deletedAt: null };

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.source) where.source = filters.source;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.campaignId) where.campaignId = filters.campaignId;
  if (filters.city) where.city = { contains: filters.city, mode: "insensitive" };
  if (filters.state) where.state = { contains: filters.state, mode: "insensitive" };
  if (filters.country) {
    where.country = { contains: filters.country, mode: "insensitive" };
  }
  if (filters.tagId) {
    where.tags = { some: { tagId: filters.tagId } };
  }
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }

  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { company: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { leadNumber: { contains: term, mode: "insensitive" } },
      { city: { contains: term, mode: "insensitive" } },
      { source: { contains: term, mode: "insensitive" } },
    ];
  }

  return where;
}

const SORTABLE: Record<string, Prisma.LeadOrderByWithRelationInput> = {
  createdAt: { createdAt: "desc" },
  updatedAt: { updatedAt: "desc" },
  name: { name: "asc" },
  status: { status: "asc" },
  priority: { priority: "asc" },
  estimatedDealValue: { estimatedDealValue: "desc" },
  expectedClosingDate: { expectedClosingDate: "asc" },
  leadNumber: { leadNumber: "desc" },
};

function resolveOrder(
  sort?: string,
  order: "asc" | "desc" = "desc",
): Prisma.LeadOrderByWithRelationInput {
  const key = sort && SORTABLE[sort] ? sort : "createdAt";
  return { [key]: order } as Prisma.LeadOrderByWithRelationInput;
}

async function resolveTagIds(
  tx: Prisma.TransactionClient,
  tagIds: string[] | undefined,
  tagsCsv: string | null | undefined,
): Promise<string[]> {
  const ids = new Set(tagIds ?? []);
  if (tagsCsv?.trim()) {
    const names = [
      ...new Set(
        tagsCsv
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
    for (const name of names) {
      const tag = await tx.tag.upsert({
        where: { name },
        create: { name },
        update: {},
        select: { id: true },
      });
      ids.add(tag.id);
    }
  }
  return [...ids];
}

export async function listLeads(
  pagination: PaginationInput,
  filters: LeadFilters = {},
) {
  const where = buildLeadWhere(filters, pagination.q);
  const [total, items] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: leadInclude,
      orderBy: resolveOrder(pagination.sort, pagination.order),
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);

  return { items, total };
}

export async function getLeadById(id: string) {
  const lead = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...leadInclude,
      attachments: { orderBy: { createdAt: "desc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      deals: {
        where: { deletedAt: null },
        include: {
          stage: true,
          pipeline: { select: { id: true, name: true } },
        },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { dueAt: "asc" },
        take: 20,
      },
    },
  });

  if (!lead) throw notFound("Lead not found");
  return lead;
}

export async function createLead(input: CreateLeadInput, userId: string) {
  const leadNumber = await nextLeadNumber();
  const { tagIds = [], tags, ...data } = input;

  const lead = await prisma.$transaction(async (tx) => {
    const resolvedTagIds = await resolveTagIds(tx, tagIds, tags);

    const created = await tx.lead.create({
      data: {
        leadNumber,
        name: data.name,
        company: data.company,
        industry: data.industry,
        email: data.email,
        phone: data.phone,
        whatsapp: data.whatsapp,
        website: data.website,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country ?? "India",
        pinCode: data.pinCode,
        source: data.source,
        campaignId: data.campaignId,
        status: data.status,
        priority: data.priority,
        estimatedDealValue: data.estimatedDealValue ?? undefined,
        expectedClosingDate: data.expectedClosingDate,
        notes: data.notes,
        assignedToId: data.assignedToId,
        createdById: userId,
        updatedById: userId,
        tags:
          resolvedTagIds.length > 0
            ? { create: resolvedTagIds.map((tagId) => ({ tagId })) }
            : undefined,
      },
      include: leadInclude,
    });

    await tx.leadActivity.create({
      data: {
        leadId: created.id,
        type: "created",
        title: "Lead created",
        description: `Lead ${created.leadNumber} was created`,
        userId,
      },
    });

    return created;
  });

  return lead;
}

export async function updateLead(
  id: string,
  input: UpdateLeadInput,
  userId: string,
) {
  const existing = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Lead not found");

  const { tagIds, tags, ...data } = input;

  const lead = await prisma.$transaction(async (tx) => {
    if (tagIds !== undefined || tags !== undefined) {
      const resolvedTagIds = await resolveTagIds(tx, tagIds, tags);
      await tx.leadTag.deleteMany({ where: { leadId: id } });
      if (resolvedTagIds.length > 0) {
        await tx.leadTag.createMany({
          data: resolvedTagIds.map((tagId) => ({ leadId: id, tagId })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await tx.lead.update({
      where: { id },
      data: {
        ...data,
        estimatedDealValue:
          data.estimatedDealValue === null
            ? null
            : data.estimatedDealValue === undefined
              ? undefined
              : data.estimatedDealValue,
        updatedById: userId,
      },
      include: leadInclude,
    });

    const changes: string[] = [];
    if (data.status && data.status !== existing.status) {
      changes.push(`status → ${data.status}`);
    }
    if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
      changes.push("assignee updated");
    }
    if (data.priority && data.priority !== existing.priority) {
      changes.push(`priority → ${data.priority}`);
    }

    await tx.leadActivity.create({
      data: {
        leadId: id,
        type: "updated",
        title: "Lead updated",
        description: changes.length ? changes.join(", ") : "Lead details updated",
        userId,
        metadata: { changes: data },
      },
    });

    return updated;
  });

  return lead;
}

export async function deleteLead(id: string, userId: string) {
  const existing = await prisma.lead.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw notFound("Lead not found");

  const lead = await prisma.$transaction(async (tx) => {
    const deleted = await tx.lead.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    });

    await tx.leadActivity.create({
      data: {
        leadId: id,
        type: "deleted",
        title: "Lead deleted",
        description: `Lead ${existing.leadNumber} soft-deleted`,
        userId,
      },
    });

    return deleted;
  });

  return lead;
}

export async function mergeLeads(input: MergeLeadsInput, userId: string) {
  const { primaryId, mergeIds } = input;
  const uniqueMergeIds = [...new Set(mergeIds.filter((id) => id !== primaryId))];
  if (uniqueMergeIds.length === 0) {
    throw validationError("Provide at least one distinct lead to merge");
  }

  const primary = await prisma.lead.findFirst({
    where: { id: primaryId, deletedAt: null },
    include: { tags: true },
  });
  if (!primary) throw notFound("Primary lead not found");

  const duplicates = await prisma.lead.findMany({
    where: { id: { in: uniqueMergeIds }, deletedAt: null },
    include: { tags: true },
  });
  if (duplicates.length !== uniqueMergeIds.length) {
    throw notFound("One or more merge leads were not found");
  }

  const fill = <T>(current: T | null | undefined, next: T | null | undefined) =>
    current == null || current === "" ? (next ?? current) : current;

  await prisma.$transaction(async (tx) => {
    const patch: Prisma.LeadUncheckedUpdateInput = {
      company: fill(primary.company, duplicates.find((d) => d.company)?.company),
      industry: fill(primary.industry, duplicates.find((d) => d.industry)?.industry),
      email: fill(primary.email, duplicates.find((d) => d.email)?.email),
      phone: fill(primary.phone, duplicates.find((d) => d.phone)?.phone),
      whatsapp: fill(primary.whatsapp, duplicates.find((d) => d.whatsapp)?.whatsapp),
      website: fill(primary.website, duplicates.find((d) => d.website)?.website),
      address: fill(primary.address, duplicates.find((d) => d.address)?.address),
      city: fill(primary.city, duplicates.find((d) => d.city)?.city),
      state: fill(primary.state, duplicates.find((d) => d.state)?.state),
      country: fill(primary.country, duplicates.find((d) => d.country)?.country),
      pinCode: fill(primary.pinCode, duplicates.find((d) => d.pinCode)?.pinCode),
      source: fill(primary.source, duplicates.find((d) => d.source)?.source),
      notes: [
        primary.notes,
        ...duplicates.map((d) => d.notes).filter(Boolean),
      ]
        .filter(Boolean)
        .join("\n---\n") || null,
      updatedById: userId,
    };

    if (!primary.campaignId) {
      const campaignId = duplicates.find((d) => d.campaignId)?.campaignId;
      if (campaignId) patch.campaignId = campaignId;
    }
    if (!primary.assignedToId) {
      const assignedToId = duplicates.find((d) => d.assignedToId)?.assignedToId;
      if (assignedToId) patch.assignedToId = assignedToId;
    }
    if (primary.estimatedDealValue == null) {
      const value = duplicates.find((d) => d.estimatedDealValue != null)
        ?.estimatedDealValue;
      if (value != null) patch.estimatedDealValue = value;
    }
    if (!primary.expectedClosingDate) {
      const date = duplicates.find((d) => d.expectedClosingDate)
        ?.expectedClosingDate;
      if (date) patch.expectedClosingDate = date;
    }

    await tx.lead.update({ where: { id: primaryId }, data: patch });

    const existingTagIds = new Set(primary.tags.map((t) => t.tagId));
    const newTags = duplicates
      .flatMap((d) => d.tags)
      .filter((t) => !existingTagIds.has(t.tagId))
      .map((t) => t.tagId);
    if (newTags.length) {
      await tx.leadTag.createMany({
        data: [...new Set(newTags)].map((tagId) => ({
          leadId: primaryId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    for (const dup of duplicates) {
      await Promise.all([
        tx.leadActivity.updateMany({
          where: { leadId: dup.id },
          data: { leadId: primaryId },
        }),
        tx.leadAttachment.updateMany({
          where: { leadId: dup.id },
          data: { leadId: primaryId },
        }),
        tx.deal.updateMany({
          where: { leadId: dup.id },
          data: { leadId: primaryId },
        }),
        tx.task.updateMany({
          where: { leadId: dup.id },
          data: { leadId: primaryId },
        }),
        tx.meeting.updateMany({
          where: { leadId: dup.id },
          data: { leadId: primaryId },
        }),
        tx.communication.updateMany({
          where: { leadId: dup.id },
          data: { leadId: primaryId },
        }),
        tx.document.updateMany({
          where: { leadId: dup.id },
          data: { leadId: primaryId },
        }),
      ]);

      await tx.lead.update({
        where: { id: dup.id },
        data: {
          deletedAt: new Date(),
          updatedById: userId,
          notes: `Merged into ${primary.leadNumber}`,
        },
      });
    }

    await tx.leadActivity.create({
      data: {
        leadId: primaryId,
        type: "merged",
        title: "Leads merged",
        description: `Merged ${duplicates.map((d) => d.leadNumber).join(", ")} into ${primary.leadNumber}`,
        userId,
        metadata: { mergeIds: uniqueMergeIds },
      },
    });
  });

  return getLeadById(primaryId);
}

export async function bulkUpdateLeads(
  input: BulkUpdateLeadsInput,
  userId: string,
) {
  const leads = await prisma.lead.findMany({
    where: { id: { in: input.ids }, deletedAt: null },
    select: { id: true },
  });
  if (leads.length === 0) throw notFound("No matching leads found");

  const ids = leads.map((l) => l.id);
  const data = {
    ...input.data,
    updatedById: userId,
  } as {
    status?: LeadStatus;
    priority?: Priority;
    assignedToId?: string | null;
    source?: string | null;
    updatedById: string;
  };

  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({
      where: { id: { in: ids } },
      data,
    });

    await tx.leadActivity.createMany({
      data: ids.map((leadId) => ({
        leadId,
        type: "bulk_update",
        title: "Bulk update",
        description: "Lead updated via bulk action",
        userId,
        metadata: input.data,
      })),
    });
  });

  return { updatedCount: ids.length, ids };
}

export async function listLeadActivities(leadId: string, pagination: PaginationInput) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true },
  });
  if (!lead) throw notFound("Lead not found");

  const where = { leadId };
  const [total, items] = await Promise.all([
    prisma.leadActivity.count({ where }),
    prisma.leadActivity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: pagination.order === "asc" ? "asc" : "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);

  return { items, total };
}

export async function createLeadActivity(
  leadId: string,
  input: CreateLeadActivityInput,
  userId: string,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true },
  });
  if (!lead) throw notFound("Lead not found");

  return prisma.leadActivity.create({
    data: {
      leadId,
      type: input.type,
      title: input.title,
      description: input.description,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      userId,
    },
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

export async function createLeadAttachment(
  leadId: string,
  input: CreateLeadAttachmentInput,
  userId: string,
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    select: { id: true },
  });
  if (!lead) throw notFound("Lead not found");

  const attachment = await prisma.leadAttachment.create({
    data: {
      leadId,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileType: input.fileType,
      fileSize: input.fileSize ?? undefined,
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "attachment",
      title: "Attachment added",
      description: input.fileName,
      metadata: {
        attachmentId: attachment.id,
        fileUrl: input.fileUrl,
      } as Prisma.InputJsonValue,
      userId,
    },
  });

  return attachment;
}

export async function convertLeadToCustomer(
  leadId: string,
  userId: string,
  options: { createContact?: boolean; notes?: string | null } = {},
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
  });
  if (!lead) throw notFound("Lead not found");
  if (lead.customerId) {
    throw validationError("Lead is already converted to a customer", {
      customerId: lead.customerId,
    });
  }

  const customerNumber = await nextCustomerNumber();

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: {
        customerNumber,
        name: lead.company || lead.name,
        legalName: lead.company,
        industry: lead.industry,
        website: lead.website,
        email: lead.email,
        phone: lead.phone,
        billingAddress: lead.address,
        billingCity: lead.city,
        billingState: lead.state,
        billingCountry: lead.country ?? "India",
        billingPinCode: lead.pinCode,
        notes: options.notes ?? lead.notes,
        assignedToId: lead.assignedToId,
        createdById: userId,
        updatedById: userId,
      },
    });

    let contact = null;
    if (options.createContact !== false) {
      contact = await tx.contact.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          customerId: customer.id,
          notes: `Converted from lead ${lead.leadNumber}`,
          createdById: userId,
          updatedById: userId,
        },
      });
    }

    const updatedLead = await tx.lead.update({
      where: { id: leadId },
      data: {
        customerId: customer.id,
        status: "WON",
        updatedById: userId,
      },
      include: leadInclude,
    });

    await tx.deal.updateMany({
      where: { leadId, deletedAt: null },
      data: { customerId: customer.id, updatedById: userId },
    });

    await tx.task.updateMany({
      where: { leadId, deletedAt: null },
      data: { customerId: customer.id },
    });

    await tx.meeting.updateMany({
      where: { leadId, deletedAt: null },
      data: { customerId: customer.id },
    });

    await tx.communication.updateMany({
      where: { leadId },
      data: { customerId: customer.id },
    });

    await tx.document.updateMany({
      where: { leadId, deletedAt: null },
      data: { customerId: customer.id },
    });

    await tx.leadActivity.create({
      data: {
        leadId,
        type: "converted",
        title: "Converted to customer",
        description: `Converted to customer ${customer.customerNumber}`,
        userId,
        metadata: { customerId: customer.id, contactId: contact?.id },
      },
    });

    return { lead: updatedLead, customer, contact };
  });

  return result;
}

export type ImportLeadRow = Record<string, string | undefined>;

export async function importLeadsFromRows(
  rows: ImportLeadRow[],
  userId: string,
) {
  const results = {
    created: 0,
    skipped: 0,
    errors: [] as { row: number; message: string }[],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name ?? row.Name ?? "").trim();
    if (!name) {
      results.skipped += 1;
      results.errors.push({ row: i + 1, message: "Name is required" });
      continue;
    }

    try {
      const email = (row.email ?? row.Email ?? "").trim() || null;
      if (email) {
        const existing = await prisma.lead.findFirst({
          where: { email, deletedAt: null },
          select: { id: true },
        });
        if (existing) {
          results.skipped += 1;
          results.errors.push({
            row: i + 1,
            message: `Duplicate email: ${email}`,
          });
          continue;
        }
      }

      const statusRaw = (row.status ?? row.Status ?? "NEW").toUpperCase();
      const priorityRaw = (row.priority ?? row.Priority ?? "MEDIUM").toUpperCase();

      await createLead(
        {
          name,
          company: (row.company ?? row.Company ?? "").trim() || null,
          industry: (row.industry ?? row.Industry ?? "").trim() || null,
          email,
          phone: (row.phone ?? row.Phone ?? "").trim() || null,
          whatsapp: (row.whatsapp ?? row.WhatsApp ?? "").trim() || null,
          website: (row.website ?? row.Website ?? "").trim() || null,
          address: (row.address ?? row.Address ?? "").trim() || null,
          city: (row.city ?? row.City ?? "").trim() || null,
          state: (row.state ?? row.State ?? "").trim() || null,
          country: (row.country ?? row.Country ?? "India").trim() || "India",
          pinCode: (row.pinCode ?? row.PIN ?? row.pin ?? "").trim() || null,
          source: (row.source ?? row.Source ?? "Import").trim() || "Import",
          status: (
            [
              "NEW",
              "CONTACTED",
              "QUALIFIED",
              "PROPOSAL",
              "NEGOTIATION",
              "WON",
              "LOST",
              "HOLD",
            ] as const
          ).includes(statusRaw as LeadStatus)
            ? (statusRaw as LeadStatus)
            : "NEW",
          priority: (["LOW", "MEDIUM", "HIGH", "URGENT"] as const).includes(
            priorityRaw as Priority,
          )
            ? (priorityRaw as Priority)
            : "MEDIUM",
          estimatedDealValue: row.estimatedDealValue
            ? Number(row.estimatedDealValue)
            : row["Estimated Deal Value"]
              ? Number(row["Estimated Deal Value"])
              : null,
          notes: (row.notes ?? row.Notes ?? "").trim() || null,
          tagIds: [],
        },
        userId,
      );
      results.created += 1;
    } catch (error) {
      results.skipped += 1;
      results.errors.push({
        row: i + 1,
        message: error instanceof Error ? error.message : "Failed to import row",
      });
    }
  }

  return results;
}

export async function exportLeads(filters: LeadFilters = {}, q?: string) {
  const where = buildLeadWhere(filters, q);
  const leads = await prisma.lead.findMany({
    where,
    include: {
      assignedTo: { select: { name: true, email: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  return leads.map((lead) => ({
    leadNumber: lead.leadNumber,
    name: lead.name,
    company: lead.company ?? "",
    industry: lead.industry ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    whatsapp: lead.whatsapp ?? "",
    website: lead.website ?? "",
    address: lead.address ?? "",
    city: lead.city ?? "",
    state: lead.state ?? "",
    country: lead.country ?? "",
    pinCode: lead.pinCode ?? "",
    source: lead.source ?? "",
    status: lead.status,
    priority: lead.priority,
    estimatedDealValue: lead.estimatedDealValue?.toString() ?? "",
    expectedClosingDate: lead.expectedClosingDate?.toISOString() ?? "",
    assignedTo: lead.assignedTo?.name ?? lead.assignedTo?.email ?? "",
    tags: lead.tags.map((t) => t.tag.name).join("; "),
    notes: lead.notes ?? "",
    createdAt: lead.createdAt.toISOString(),
  }));
}
