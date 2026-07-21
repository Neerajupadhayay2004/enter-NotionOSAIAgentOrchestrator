// Marketing <-> Finance budget negotiation orchestrator.
//
// This function is the "orchestrator" referenced in the architecture brief:
// runtime negotiation state (who said what, in what order) lives here and in
// the agent_actions/budget_requests tables. Durable organizational state
// (the record a human or new teammate would read) gets written to Notion at
// the end of the negotiation. Notion is never used as a message bus between
// agents — only the final outcome is synced there.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_af4c304323bc")!;
const AI_MODEL = "google/gemini-3.5-flash";
const AI_BASE = "https://api.enter.pro/code/api/ai/v1beta/models";
const NOTION_VERSION = "2022-06-28";

const FINANCE_NOTION_TOKEN = Deno.env.get("FINANCE_NOTION_TOKEN")!;
const NOTION_REQUESTS_DB_ID = Deno.env.get("NOTION_REQUESTS_DB_ID")!;
const NOTION_POLICIES_DB_ID = Deno.env.get("NOTION_POLICIES_DB_ID")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Policy {
  category: string;
  monthlyLimit: number;
  requiresApprovalAbove: number;
  notes: string;
}

async function callAgent(systemInstruction: string, userPrompt: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${AI_BASE}/${AI_MODEL}:streamGenerateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": AI_API_TOKEN,
      "Content-Type": "application/json",
      "X-Session-ID": crypto.randomUUID(),
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI gateway error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const text = await response.text();
  let fullText = "";
  const lines = text.split(String.fromCharCode(10));
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload);
      for (const part of chunk?.candidates?.[0]?.content?.parts ?? []) {
        if (typeof part.text === "string") fullText += part.text;
      }
    } catch { /* ignore keep-alive noise */ }
  }
  if (!fullText.trim()) throw new Error("AI gateway returned an empty response");
  try {
    return JSON.parse(fullText);
  } catch {
    throw new Error(`Agent returned non-JSON output: ${fullText.slice(0, 300)}`);
  }
}

async function notionFetch(token: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Notion API error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
  return response.json();
}

// Finance's own token is the only one shared with the Policies DB.
// This is the real, enforced access-control boundary: Marketing's agent
// code never touches this token or this database.
async function getPolicy(category: string): Promise<Policy | null> {
  const result = await notionFetch(FINANCE_NOTION_TOKEN, `/databases/${NOTION_POLICIES_DB_ID}/query`, {
    method: "POST",
    body: JSON.stringify({
      filter: { property: "Category", title: { equals: category } },
    }),
  });
  const page = result.results?.[0];
  if (!page) return null;
  const props = page.properties;
  return {
    category: props.Category?.title?.[0]?.plain_text ?? category,
    monthlyLimit: props["Monthly Limit"]?.number ?? 0,
    requiresApprovalAbove: props["Requires Approval Above"]?.number ?? 0,
    notes: props.Notes?.rich_text?.[0]?.plain_text ?? "",
  };
}

async function logAction(requestId: string, actor: string, actionType: string, amount: number | null, reasoning: string, payload: Record<string, unknown> = {}) {
  await supabase.from("agent_actions").insert({
    request_id: requestId,
    actor,
    action_type: actionType,
    amount,
    reasoning,
    payload,
  });
}

async function createNotionRequestPage(request: {
  campaign_name: string; category: string; requested_amount: number;
  final_amount: number; justification: string; requested_by: string;
  negotiationSummary: string;
}) {
  const page = await notionFetch(FINANCE_NOTION_TOKEN, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_REQUESTS_DB_ID },
      properties: {
        Name: { title: [{ text: { content: request.campaign_name } }] },
        Category: { select: { name: request.category } },
        "Requested Amount": { number: request.requested_amount },
        "Approved Amount": { number: request.final_amount },
        Status: { select: { name: "Pending Approval" } },
        "Decision Notes": { rich_text: [{ text: { content: request.negotiationSummary.slice(0, 2000) } }] },
        "Requested By": { rich_text: [{ text: { content: request.requested_by } }] },
      },
    }),
  });
  return page;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requestId } = await req.json();
    if (!requestId) throw new Error("requestId is required");

    const { data: request, error: fetchError } = await supabase
      .from("budget_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (fetchError || !request) throw new Error("Budget request not found");

    // --- Round 0: Marketing proposes (already captured at submission time) ---
    await logAction(
      requestId, "marketing", "propose", request.requested_amount,
      request.justification,
      { campaign_name: request.campaign_name, category: request.category },
    );

    // --- Finance checks policy (reads Notion Policies DB — Marketing cannot) ---
    const policy = await getPolicy(request.category);
    const limit = policy?.requiresApprovalAbove ?? policy?.monthlyLimit ?? Infinity;

    const financeSystemLines = [
      "You are the Finance agent of an AI-native company. You review budget requests against policy.",
      `Policy for this category: monthly limit ${policy?.monthlyLimit ?? "unknown"}, requires special approval above ${limit}. Notes: ${policy?.notes ?? "none"}.`,
      `Respond ONLY with strict JSON: {"withinPolicy": boolean, "recommendedAmount": number, "reasoning": string (1-3 sentences, plain business language, no markdown)}.`,
    ];
    const financeUserLines = [
      `Campaign: ${request.campaign_name}`,
      `Category: ${request.category}`,
      `Requested amount: ${request.requested_amount}`,
      `Marketing's justification: ${request.justification}`,
    ];

    const financeReview = await callAgent(financeSystemLines.join(String.fromCharCode(10)), financeUserLines.join(String.fromCharCode(10)));

    let finalAmount = request.requested_amount;
    let negotiationSummary = `Marketing requested $${request.requested_amount} for "${request.campaign_name}" (${request.category}). `;

    await logAction(
      requestId, "finance", "review", financeReview.recommendedAmount as number,
      financeReview.reasoning as string,
      { withinPolicy: financeReview.withinPolicy, policyLimit: limit },
    );

    if (!financeReview.withinPolicy) {
      // --- Real disagreement: Finance counters ---
      const counterAmount = financeReview.recommendedAmount as number;
      await logAction(requestId, "finance", "counter", counterAmount, financeReview.reasoning as string, { policyLimit: limit });
      negotiationSummary += `Finance flagged this as over the ${policy?.category ?? request.category} policy limit ($${limit}) and countered with $${counterAmount}: "${financeReview.reasoning}". `;

      // --- Marketing responds to the counter (bounded to one round) ---
      const marketingSystemLines = [
        "You are the Marketing agent of an AI-native company. Finance pushed back on your budget request with a counter-offer.",
        "Decide whether to accept Finance's counter-offer or make one final case for a different amount (never higher than your original ask).",
        `Respond ONLY with strict JSON: {"decision": "accept" | "escalate", "finalAmount": number, "reasoning": string (1-3 sentences, plain business language)}.`,
      ];
      const marketingUserLines = [
        `Your original request: $${request.requested_amount} for "${request.campaign_name}".`,
        `Your justification: ${request.justification}`,
        `Finance's counter-offer: $${counterAmount}`,
        `Finance's reasoning: ${financeReview.reasoning}`,
      ];

      const marketingResponse = await callAgent(marketingSystemLines.join(String.fromCharCode(10)), marketingUserLines.join(String.fromCharCode(10)));

      await logAction(
        requestId, "marketing", marketingResponse.decision === "accept" ? "accept" : "escalate",
        marketingResponse.finalAmount as number, marketingResponse.reasoning as string, {},
      );

      // Settle: if Marketing escalates, Finance's counter still wins (bounded negotiation, 2 rounds max)
      finalAmount = marketingResponse.decision === "accept"
        ? (marketingResponse.finalAmount as number)
        : counterAmount;

      negotiationSummary += marketingResponse.decision === "accept"
        ? `Marketing accepted: "${marketingResponse.reasoning}". `
        : `Marketing pushed back once more ("${marketingResponse.reasoning}") but Finance's policy-bound counter of $${counterAmount} stands. `;
    } else {
      finalAmount = financeReview.recommendedAmount as number;
      negotiationSummary += `Finance approved within policy: "${financeReview.reasoning}". `;
    }

    negotiationSummary += `Final negotiated amount: $${finalAmount}. Awaiting human approval.`;

    // --- Sync durable outcome to Notion (human approval gate lives here) ---
    const notionPage = await createNotionRequestPage({
      campaign_name: request.campaign_name,
      category: request.category,
      requested_amount: request.requested_amount,
      final_amount: finalAmount,
      justification: request.justification,
      requested_by: request.requested_by,
      negotiationSummary,
    });

    await supabase.from("budget_requests").update({
      status: "pending_approval",
      final_amount: finalAmount,
      notion_page_id: notionPage.id,
      notion_url: notionPage.url,
    }).eq("id", requestId);

    await logAction(requestId, "system", "notion_synced", finalAmount, "Negotiation outcome recorded in Notion; awaiting human decision.", { notion_url: notionPage.url });

    return new Response(JSON.stringify({ success: true, finalAmount, notionUrl: notionPage.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("run-negotiation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
