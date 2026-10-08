import type { AiInsightType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export type AiInsightRequest = {
  entityType: string;
  entityId: string;
  context?: Record<string, unknown>;
};

export type AiInsightResult = {
  type: AiInsightType;
  entityType: string;
  entityId: string;
  payload: Prisma.InputJsonValue;
  score?: number | null;
  model: string;
};

export interface AiProvider {
  readonly name: string;
  scoreLead(req: AiInsightRequest): Promise<AiInsightResult>;
  draftEmail(req: AiInsightRequest): Promise<AiInsightResult>;
  summarizeCall(req: AiInsightRequest): Promise<AiInsightResult>;
  summarizeMeeting(req: AiInsightRequest): Promise<AiInsightResult>;
  customerInsight(req: AiInsightRequest): Promise<AiInsightResult>;
  predictSales(req: AiInsightRequest): Promise<AiInsightResult>;
  predictChurn(req: AiInsightRequest): Promise<AiInsightResult>;
  recommend(req: AiInsightRequest): Promise<AiInsightResult>;
}

async function persistInsight(result: AiInsightResult) {
  return prisma.aiInsight.create({
    data: {
      type: result.type,
      entityType: result.entityType,
      entityId: result.entityId,
      payload: result.payload,
      score: result.score ?? undefined,
      model: result.model,
    },
  });
}

/**
 * Stub AI provider — returns deterministic placeholder insights and stores them.
 * Swap implementation when an LLM / scoring service is wired up.
 */
export class StubAiProvider implements AiProvider {
  readonly name = "stub-ai";
  private readonly model = "vayuguard-stub-v1";

  async scoreLead(req: AiInsightRequest): Promise<AiInsightResult> {
    const score = 55 + (req.entityId.charCodeAt(0) % 40);
    const result: AiInsightResult = {
      type: "LEAD_SCORE",
      entityType: req.entityType,
      entityId: req.entityId,
      score,
      model: this.model,
      payload: {
        score,
        factors: [
          { name: "engagement", weight: 0.35, value: score * 0.9 },
          { name: "fit", weight: 0.4, value: score },
          { name: "intent", weight: 0.25, value: score * 0.8 },
        ],
        recommendation:
          score >= 75 ? "Prioritize outreach" : "Nurture with follow-ups",
      },
    };
    await persistInsight(result);
    return result;
  }

  async draftEmail(req: AiInsightRequest): Promise<AiInsightResult> {
    const result: AiInsightResult = {
      type: "EMAIL_DRAFT",
      entityType: req.entityType,
      entityId: req.entityId,
      model: this.model,
      payload: {
        subject: "Following up — VayuCrm",
        body: `Hi,\n\nThank you for your interest in VayuCrm. I'd love to schedule a short call to understand your requirements.\n\nBest regards`,
        tone: "professional",
        context: (req.context ?? {}) as Prisma.InputJsonValue,
      },
    };
    await persistInsight(result);
    return result;
  }

  async summarizeCall(req: AiInsightRequest): Promise<AiInsightResult> {
    const result: AiInsightResult = {
      type: "CALL_SUMMARY",
      entityType: req.entityType,
      entityId: req.entityId,
      model: this.model,
      payload: {
        summary: "Stub call summary — replace with real transcription pipeline.",
        actionItems: ["Send proposal", "Schedule demo"],
        sentiment: "neutral",
      },
    };
    await persistInsight(result);
    return result;
  }

  async summarizeMeeting(req: AiInsightRequest): Promise<AiInsightResult> {
    const result: AiInsightResult = {
      type: "MEETING_SUMMARY",
      entityType: req.entityType,
      entityId: req.entityId,
      model: this.model,
      payload: {
        summary:
          "Stub meeting summary — replace with real meeting notes pipeline.",
        decisions: [],
        nextSteps: ["Share quotation", "Confirm timeline"],
      },
    };
    await persistInsight(result);
    return result;
  }

  async customerInsight(req: AiInsightRequest): Promise<AiInsightResult> {
    const result: AiInsightResult = {
      type: "CUSTOMER_INSIGHT",
      entityType: req.entityType,
      entityId: req.entityId,
      score: 70,
      model: this.model,
      payload: {
        health: "good",
        opportunities: ["Upsell monitoring package"],
        risks: [],
      },
    };
    await persistInsight(result);
    return result;
  }

  async predictSales(req: AiInsightRequest): Promise<AiInsightResult> {
    const result: AiInsightResult = {
      type: "SALES_PREDICTION",
      entityType: req.entityType,
      entityId: req.entityId,
      score: 0.62,
      model: this.model,
      payload: {
        winProbability: 0.62,
        forecastAmount: null,
        horizonDays: 30,
      },
    };
    await persistInsight(result);
    return result;
  }

  async predictChurn(req: AiInsightRequest): Promise<AiInsightResult> {
    const result: AiInsightResult = {
      type: "CHURN_PREDICTION",
      entityType: req.entityType,
      entityId: req.entityId,
      score: 0.18,
      model: this.model,
      payload: {
        churnRisk: "low",
        probability: 0.18,
        drivers: ["stable engagement"],
      },
    };
    await persistInsight(result);
    return result;
  }

  async recommend(req: AiInsightRequest): Promise<AiInsightResult> {
    const result: AiInsightResult = {
      type: "RECOMMENDATION",
      entityType: req.entityType,
      entityId: req.entityId,
      model: this.model,
      payload: {
        recommendations: [
          {
            action: "schedule_follow_up",
            reason: "No activity in recent window (stub)",
            priority: "medium",
          },
        ],
      },
    };
    await persistInsight(result);
    return result;
  }
}

export const aiProvider: AiProvider = new StubAiProvider();
