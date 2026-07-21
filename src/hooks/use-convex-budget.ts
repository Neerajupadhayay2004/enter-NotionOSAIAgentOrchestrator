import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { BudgetRequest } from "@/types/enterprise-os";
import type { AiReviewResult } from "@/components/enterprise-os/approval-panel";

export function useConvexBudgetSync(request: BudgetRequest | null) {
  const upsert = useMutation(api.budgetSync.upsert);
  const recordDecision = useMutation(api.budgetSync.recordDecision);
  const saveAiReview = useMutation(api.aiReview.save);

  useEffect(() => {
    if (!request) return;
    upsert({
      supabaseId: request.id,
      campaignName: request.campaign_name,
      category: request.category,
      requestedAmount: Number(request.requested_amount),
      finalAmount: request.final_amount != null ? Number(request.final_amount) : undefined,
      status: request.status,
      justification: request.justification,
      requestedBy: request.requested_by,
      notionUrl: request.notion_url ?? undefined,
    }).catch((err) => {
      console.warn("Convex upsert failed (non-critical):", err);
    });
  }, [request, upsert]);

  const syncDecision = async (status: string) => {
    if (!request) return;
    try {
      await recordDecision({
        supabaseId: request.id,
        status,
        humanDecision: status === "completed" ? "approved" : "rejected",
      });
    } catch (err) {
      console.warn("Convex decision sync failed (non-critical):", err);
    }
  };

  const syncAiReview = async (review: AiReviewResult) => {
    if (!request) return;
    try {
      await saveAiReview({
        requestSupabaseId: request.id,
        recommendation: review.recommendation,
        confidence: review.confidence,
        reasoning: review.reasoning,
        riskFactors: review.riskFactors,
        strengths: review.strengths,
        provider: (review as Record<string, unknown>).provider as string ?? undefined,
      });
    } catch (err) {
      console.warn("Convex AI review sync failed (non-critical):", err);
    }
  };

  return { syncDecision, syncAiReview };
}
