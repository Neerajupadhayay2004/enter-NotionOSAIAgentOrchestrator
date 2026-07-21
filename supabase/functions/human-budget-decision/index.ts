// In-app human approve/reject for budget requests.
// Syncs decision to Notion and creates GitHub issue on approval.

import { applyBudgetDecision, getServiceClient } from "../_shared/budget-decision.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requestId, decision, notes } = await req.json();
    if (!requestId) throw new Error("requestId is required");
    if (decision !== "approve" && decision !== "reject") {
      throw new Error('decision must be "approve" or "reject"');
    }

    const supabase = getServiceClient();
    const result = await applyBudgetDecision(supabase, requestId, decision, {
      notes,
      source: "in-app",
    });

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("human-budget-decision error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
