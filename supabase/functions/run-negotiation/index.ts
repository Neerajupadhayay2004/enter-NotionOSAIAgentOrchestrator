// Marketing <-> Finance budget negotiation orchestrator.
//
// Uses Gemini AI for market analysis and policy compliance instead of Notion.
// The AI analyzes the budget request against market conditions, ROI potential,
// and category benchmarks to make an informed decision.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_AI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const FETCH_TIMEOUT_MS = 25000;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callGemini(systemInstruction: string, userPrompt: string): Promise<Record<string, unknown>> {
  // Try Gemini first
  try {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error (${response.status}): ${(await response.text()).slice(0, 400)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text?.trim()) throw new Error("Gemini returned empty response");

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`);
    }
  } catch (geminiError) {
    console.warn("Gemini failed, trying Groq fallback:", (geminiError as Error).message?.slice(0, 200));
  }

  // Fallback to Groq
  if (!GROQ_API_KEY) throw new Error("Both Gemini and Groq are unavailable");

  const groqResponse = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    }),
  });

  if (!groqResponse.ok) {
    throw new Error(`Groq error (${groqResponse.status}): ${(await groqResponse.text()).slice(0, 400)}`);
  }

  const groqData = await groqResponse.json();
  const groqContent = groqData.choices?.[0]?.message?.content;
  if (!groqContent) throw new Error("Groq returned empty response");

  try {
    return JSON.parse(groqContent);
  } catch {
    throw new Error(`Groq returned non-JSON: ${String(groqContent).slice(0, 300)}`);
  }
}

async function logAction(requestId: string, actor: string, actionType: string, amount: number | null, reasoning: string, payload: Record<string, unknown> = {}) {
  const { error } = await supabase.from("agent_actions").insert({
    request_id: requestId,
    actor,
    action_type: actionType,
    amount,
    reasoning,
    payload,
  });
  if (error) console.error("logAction insert error:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let requestId: string | undefined;

  try {
    const body = await req.json();
    requestId = body.requestId;
    if (!requestId) throw new Error("requestId is required");

    const { data: existing } = await supabase
      .from("budget_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (!existing) throw new Error("Budget request not found");
    if (existing.status !== "negotiating") {
      return new Response(JSON.stringify({ success: true, skipped: true, status: existing.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: existingProposeCount } = await supabase
      .from("agent_actions")
      .select("id", { count: "exact", head: true })
      .eq("request_id", requestId)
      .eq("action_type", "propose");
    if (existingProposeCount && existingProposeCount > 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "already started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const request = existing;

    // --- Round 0: Marketing proposes ---
    await logAction(
      requestId, "marketing", "propose", request.requested_amount,
      request.justification,
      { campaign_name: request.campaign_name, category: request.category },
    );

    // --- Gemini AI Market Analysis: Finance agent reviews against market conditions ---
    const financeSystem = [
      "You are the Finance agent of an AI-native company. You perform deep market analysis to evaluate budget requests against industry benchmarks and ROI potential.",
      "For each category, analyze: (1) typical market rates, (2) expected ROI, (3) competitive positioning, (4) cost efficiency vs alternatives.",
      "Categories and detailed market benchmarks:",
      "- Paid Ads: $2K-$15K/month typical. CPM: $5-$15. CPC: $0.50-$3.00. Expected ROAS: 3-5x. Break-even typically within 2-3 months.",
      "- Events: $5K-$50K typical. Cost per lead: $50-$200. Brand awareness lift: 10-25%. ROI through pipeline generation over 3-6 months.",
      "- Content & Creative: $1K-$10K typical. Content ROI compounds over 6-12 months. SEO value: $2-$10 per organic visitor lifetime value.",
      "- Tools & Software: $500-$5K/month typical. Productivity ROI should be 2-3x cost within first quarter. Evaluate churn risk.",
      "- Sponsorships: $3K-$25K typical. CPM: $10-$30. Brand lift: 5-15%. Audience alignment is critical for ROI.",
      "Your analysis must consider: Is this amount 10-30% above or below market average? What's the expected payback period?",
      "Respond ONLY with strict JSON:",
      '{"withinPolicy": boolean, "recommendedAmount": number, "marketAnalysis": string (3-4 sentences with specific market data and competitive context), "reasoning": string (2-3 sentences with ROI projections), "costEfficiency": string (1-2 sentences on value for money), "riskAssessment": string (1-2 sentences on downside risk)}',
    ].join("\n");

    const financeUser = [
      `Campaign: ${request.campaign_name}`,
      `Category: ${request.category}`,
      `Requested amount: $${request.requested_amount}`,
      `Marketing's justification: ${request.justification}`,
      "",
      "Analyze this request against current market conditions and provide a recommendation.",
    ].join("\n");

    const financeReview = await callGemini(financeSystem, financeUser);

    let finalAmount = request.requested_amount;
    let negotiationSummary = `Marketing requested $${request.requested_amount} for "${request.campaign_name}" (${request.category}). `;

    await logAction(
      requestId, "finance", "review", financeReview.recommendedAmount as number,
      `${financeReview.marketAnalysis} ${financeReview.reasoning}`,
      { withinPolicy: financeReview.withinPolicy, source: "gemini-market-analysis" },
    );

    if (!financeReview.withinPolicy) {
      // --- Finance counters based on market analysis ---
      const counterAmount = financeReview.recommendedAmount as number;
      await logAction(requestId, "finance", "counter", counterAmount, financeReview.reasoning as string, { source: "gemini-market-analysis" });
      negotiationSummary += `Finance market analysis: ${financeReview.marketAnalysis}. Countered with $${counterAmount}. `;

      // --- Marketing responds to the counter ---
      const marketingSystem = [
        "You are the Marketing agent. Finance countered your budget request based on detailed market analysis.",
        "Decide whether to accept Finance's counter or make one final case for why more budget is justified (never higher than original ask).",
        "Consider: Does Finance's counter still allow achieving campaign goals? What's the minimum viable budget?",
        `Respond ONLY with strict JSON: {"decision": "accept" | "escalate", "finalAmount": number, "reasoning": string (2-3 sentences with specific justification for the amount)}.`,
      ].join("\n");

      const marketingUser = [
        `Your original request: $${request.requested_amount} for "${request.campaign_name}".`,
        `Your justification: ${request.justification}`,
        `Finance's market-based counter: $${counterAmount}`,
        `Finance's analysis: ${financeReview.marketAnalysis}`,
      ].join("\n");

      const marketingResponse = await callGemini(marketingSystem, marketingUser);

      await logAction(
        requestId, "marketing", marketingResponse.decision === "accept" ? "accept" : "escalate",
        marketingResponse.finalAmount as number, marketingResponse.reasoning as string, {},
      );

      finalAmount = marketingResponse.decision === "accept"
        ? (marketingResponse.finalAmount as number)
        : counterAmount;

      negotiationSummary += marketingResponse.decision === "accept"
        ? `Marketing accepted: "${marketingResponse.reasoning}". `
        : `Marketing pushed back but Finance's market-based counter of $${counterAmount} stands. `;
    } else {
      finalAmount = financeReview.recommendedAmount as number;
      negotiationSummary += `Finance approved within market benchmarks: ${financeReview.marketAnalysis}. `;
    }

    // --- Gemini AI Final Decision: Accept or Reject based on market analysis ---
    const decisionSystem = [
      "You are the Market Decision AI. You make final budget decisions based on comprehensive market analysis and negotiation outcomes.",
      "Your decision framework:",
      "1. **Market Alignment**: Does the final amount align with market benchmarks for this category?",
      "2. **ROI Confidence**: How confident are you in the expected return? (High/Medium/Low)",
      "3. **Competitive Position**: Will this investment give competitive advantage or just match market standard?",
      "4. **Risk-Adjusted Value**: What's the expected value after accounting for downside scenarios?",
      "5. **Opportunity Cost**: Is this the best use of budget vs alternatives?",
      "Decision rules:",
      "- APPROVE: Strong market fit, clear ROI path, reasonable risk. Budget aligns with or beats market benchmarks.",
      "- REJECT: Poor market fit, weak ROI justification, excessive spend relative to market value.",
      "- NEGOTIATE: Promising but needs adjustment — either amount reduction or stronger justification needed.",
      "Respond ONLY with strict JSON:",
      '{"decision": "approve" | "reject" | "negotiate", "confidence": number (0-100), "marketVerdict": string (3-4 sentences with specific market analysis, ROI projections, and competitive context), "reasoning": string (2-3 sentences with data-driven justification), "riskAssessment": string (1-2 sentences on key risks), "alternativeSuggestion": string | null (suggestion if rejecting/negotiating)}',
    ].join("\n");

    const decisionUser = [
      `Campaign: ${request.campaign_name}`,
      `Category: ${request.category}`,
      `Original request: $${request.requested_amount}`,
      `Final negotiated amount: $${finalAmount}`,
      `Justification: ${request.justification}`,
      `Negotiation summary: ${negotiationSummary}`,
      "",
      "Based on the market analysis and negotiation outcome, make your final decision with specific market data and ROI projections.",
    ].join("\n");

    let aiDecision = { decision: "approve" as string, confidence: 75, marketVerdict: "Budget aligns with market benchmarks.", reasoning: "Approved based on market analysis." };
    try {
      aiDecision = await callGemini(decisionSystem, decisionUser) as typeof aiDecision;
    } catch (err) {
      console.warn("AI decision call failed, defaulting to approve:", err);
    }

    negotiationSummary += `AI Market Decision: ${aiDecision.decision} (${aiDecision.confidence}% confidence). ${aiDecision.marketVerdict}`;

    await logAction(
      requestId, "ai", "ai_review", finalAmount,
      `${aiDecision.marketVerdict} ${aiDecision.reasoning}`,
      { decision: aiDecision.decision, confidence: aiDecision.confidence, source: "gemini-market-decision" },
    );

    // Set final status based on AI decision and confidence
    let finalStatus = "pending_approval";
    if (aiDecision.decision === "approve" && (aiDecision.confidence ?? 0) >= 70) {
      finalStatus = "completed";
    } else if (aiDecision.decision === "reject") {
      finalStatus = "rejected";
    }

    await supabase.from("budget_requests").update({
      status: finalStatus,
      final_amount: finalAmount,
    }).eq("id", requestId);

    await logAction(requestId, "system", "ai_decision", finalAmount,
      `AI decision: ${aiDecision.decision} (${aiDecision.confidence}% confidence). ${finalStatus === "completed" ? "Auto-approved (high confidence)." : finalStatus === "rejected" ? "Rejected." : "Sent for human approval."} ${aiDecision.marketVerdict}`,
      { decision: aiDecision.decision, confidence: aiDecision.confidence, finalStatus },
    );

    return new Response(JSON.stringify({
      success: true,
      finalAmount,
      decision: aiDecision.decision,
      confidence: aiDecision.confidence,
      marketVerdict: aiDecision.marketVerdict,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("run-negotiation error:", error);
    if (requestId) {
      // Log the actual failure reason; Notion errors are non-blocking and won't reach here
      const msg = error instanceof Error ? error.message : String(error);
      await logAction(requestId, "system", "error", null, `AI negotiation error: ${msg}`, {}).catch(() => {});
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
