import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { supabase } from "@/integrations/supabase/client";

const PYTHON_BACKEND_URL =
  import.meta.env.VITE_PYTHON_BACKEND_URL ?? "http://localhost:8000";

export interface NegotiationResult {
  success: boolean;
  status: string;
  finalAmount: number | null;
  recommendation: string;
  confidence: number;
  reasoning: string;
  error?: string;
}

export function useBudgetNegotiation() {
  const [isNegotiating, setIsNegotiating] = useState(false);
  const convexUpsert = useMutation(api.budgetSync.upsert);

  const negotiate = useCallback(async (requestId: string): Promise<NegotiationResult> => {
    setIsNegotiating(true);
    try {
      // 1. Fetch the request from Supabase
      const { data: request, error: fetchError } = await supabase
        .from("budget_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (fetchError || !request) {
        throw new Error("Budget request not found");
      }

      // 2. Call Python backend for AI analysis (Gemini -> Groq -> OpenRouter)
      const aiResponse = await fetch(`${PYTHON_BACKEND_URL}/api/ai/analyze-budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_name: request.campaign_name,
          category: request.category,
          requested_amount: Number(request.requested_amount),
          final_amount: request.final_amount != null ? Number(request.final_amount) : null,
          status: request.status,
          justification: request.justification,
          requested_by: request.requested_by,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI analysis failed: ${aiResponse.status}`);
      }

      const aiResult = await aiResponse.json();

      // 3. Determine final status based on AI recommendation + confidence
      const confidence = aiResult.confidence ?? 50;
      let finalStatus: string;
      let finalAmount = request.final_amount ?? request.requested_amount;

      if (aiResult.recommendation === "approve" && confidence >= 70) {
        finalStatus = "completed";
      } else if (aiResult.recommendation === "reject") {
        finalStatus = "rejected";
      } else if (aiResult.recommendation === "negotiate" && aiResult.recommended_amount) {
        finalStatus = "pending_approval";
        finalAmount = aiResult.recommended_amount;
      } else {
        finalStatus = "pending_approval";
      }

      // 4. Update Supabase with the result
      await supabase
        .from("budget_requests")
        .update({
          status: finalStatus,
          final_amount: finalAmount,
        })
        .eq("id", requestId);

      // 5. Log the AI decision
      await supabase.from("agent_actions").insert({
        request_id: requestId,
        actor: "ai",
        action_type: "ai_decision",
        amount: finalAmount,
        reasoning: aiResult.reasoning,
        payload: {
          recommendation: aiResult.recommendation,
          confidence,
          provider: aiResult.provider,
          risk_factors: aiResult.risk_factors,
          strengths: aiResult.strengths,
          finalStatus,
        },
      });

      // 6. Sync to Convex (real-time dashboard)
      try {
        await convexUpsert({
          supabaseId: requestId,
          campaignName: request.campaign_name,
          category: request.category,
          requestedAmount: Number(request.requested_amount),
          finalAmount: finalAmount,
          status: finalStatus,
          justification: request.justification,
          requestedBy: request.requested_by,
        });
      } catch (convexErr) {
        console.warn("Convex sync failed (non-critical):", convexErr);
      }

      return {
        success: true,
        status: finalStatus,
        finalAmount,
        recommendation: aiResult.recommendation,
        confidence,
        reasoning: aiResult.reasoning,
      };
    } catch (err) {
      console.error("Negotiation failed:", err);
      return {
        success: false,
        status: "negotiating",
        finalAmount: null,
        recommendation: "negotiate",
        confidence: 0,
        reasoning: "",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    } finally {
      setIsNegotiating(false);
    }
  }, [convexUpsert]);

  return { negotiate, isNegotiating };
}
