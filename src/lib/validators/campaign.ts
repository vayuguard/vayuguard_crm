import { CampaignChannel, CampaignStatus } from "@prisma/client";
import { z } from "zod";
import {
  emptyToNull,
  optionalDate,
  optionalDecimal,
} from "./common";

export const campaignChannelSchema = z.nativeEnum(CampaignChannel);
export const campaignStatusSchema = z.nativeEnum(CampaignStatus);

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  channel: campaignChannelSchema,
  status: campaignStatusSchema.optional().default(CampaignStatus.DRAFT),
  subject: emptyToNull,
  content: emptyToNull,
  budget: optionalDecimal,
  spent: z.coerce.number().finite().min(0).optional().default(0),
  scheduledAt: optionalDate,
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const campaignFiltersSchema = z.object({
  status: campaignStatusSchema.optional(),
  channel: campaignChannelSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updateCampaignMetricsSchema = z.object({
  sentCount: z.coerce.number().int().min(0).optional(),
  openCount: z.coerce.number().int().min(0).optional(),
  clickCount: z.coerce.number().int().min(0).optional(),
  replyCount: z.coerce.number().int().min(0).optional(),
  leadCount: z.coerce.number().int().min(0).optional(),
  revenue: z.coerce.number().finite().min(0).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CampaignFilters = z.infer<typeof campaignFiltersSchema>;
export type UpdateCampaignMetricsInput = z.infer<
  typeof updateCampaignMetricsSchema
>;
