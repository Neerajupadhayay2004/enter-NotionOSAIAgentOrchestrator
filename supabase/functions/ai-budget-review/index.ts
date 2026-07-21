// Gemini-powered board advisor: analyzes a pending budget request and
// recommends approve, reject, or negotiate with structured reasoning.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { callGeminiJson, type GeminiJsonResult } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requestId, forceRefresh } = await req.json();
    if (!requestId) throw new Error("requestId is required");

    const { data: request, error } = await supabase
      .from("budget_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (error || !request) throw new Error("Budget request not found");

    if (!forceRefresh) {
      const { data: existing } = await supabase
        .from("agent_actions")
        .select("*")
        .eq("request_id", requestId)
        .eq("action_type", "ai_review")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.payload) {
        const payload = existing.payload as Record<string, unknown>;
        return new Response(JSON.stringify({
          cached: true,
          recommendation: payload.recommendation,
          confidence: payload.confidence,
          reasoning: existing.reasoning,
          riskFactors: payload.riskFactors ?? [],
          strengths: payload.strengths ?? [],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { data: actions } = await supabase
      .from("agent_actions")
      .select("actor, action_type, amount, reasoning, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    const negotiationLog = (actions ?? [])
      .filter((a) => a.action_type !== "ai_review")
      .map((a) => `${a.actor} ${a.action_type}${a.amount != null ? ` $${a.amount}` : ""}: ${a.reasoning ?? ""}`)
      .join("\n");

    const systemInstruction = [
      "You are the Board Advisor AI for an enterprise budget operating system.",
      "Analyze the budget request holistically: policy compliance, ROI potential, justification quality, negotiation outcome, and financial prudence.",
      "Respond ONLY with strict JSON:",
      '{"recommendation":"approve"|"reject"|"negotiate","confidence":number(0-100),"reasoning":string(2-4 sentences),"riskFactors":string[],"strengths":string[]}',
      "Use approve when the negotiated amount is reasonable and well-justified.",
      "Use reject when the spend is unjustified, excessive, or policy-violating.",
      "Use negotiate when the amount could work but needs further reduction or clarification.",
    ].join("\n");

    const userPrompt = [
      `Campaign: ${request.campaign_name}`,
      `Category: ${request.category}`,
      `Requested amount: $${request.requested_amount}`,
      `Negotiated final amount: $${request.final_amount ?? "pending"}`,
      `Status: ${request.status}`,
      `Justification: ${request.justification}`,
      `Requested by: ${request.requested_by}`,
      "",
      "Negotiation timeline:",
      negotiationLog || "No negotiation actions yet.",
    ].join("\n");

    const analysis = await callGeminiJson<GeminiJsonResult>(systemInstruction, userPrompt);

    const reasoning = analysis.reasoning
      ?? `AI recommends ${analysis.recommendation} with ${analysis.confidence}% confidence.`;

    await supabase.from("agent_actions").insert({
      request_id: requestId,
      actor: "ai",
      action_type: "ai_review",
      amount: request.final_amount,
      reasoning,
      payload: {
        recommendation: analysis.recommendation,
        confidence: analysis.confidence,
        riskFactors: analysis.riskFactors ?? [],
        strengths: analysis.strengths ?? [],
        model: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash",
      },
    });

    return new Response(JSON.stringify({
      cached: false,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      reasoning,
      riskFactors: analysis.riskFactors ?? [],
      strengths: analysis.strengths ?? [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("ai-budget-review error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
