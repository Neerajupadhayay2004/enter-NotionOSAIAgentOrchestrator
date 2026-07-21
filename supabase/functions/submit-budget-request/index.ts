// Creates a new budget request row and kicks off the Marketing<->Finance
// negotiation orchestrator (run-negotiation). Called from the frontend
// "New Request" form.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignName, category, requestedAmount, justification, requestedBy } = await req.json();

    if (!campaignName || !category || !requestedAmount || !justification) {
      throw new Error("campaignName, category, requestedAmount, and justification are required");
    }

    const { data: request, error: insertError } = await supabase
      .from("budget_requests")
      .insert({
        campaign_name: campaignName,
        category,
        requested_amount: requestedAmount,
        justification,
        requested_by: requestedBy || "Marketing Team",
        status: "negotiating",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const negotiationResponse = await fetch(`${SUPABASE_URL}/functions/v1/run-negotiation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ requestId: request.id }),
    });

    if (!negotiationResponse.ok) {
      const errorText = await negotiationResponse.text();
      console.error("run-negotiation failed:", errorText);
      await supabase.from("budget_requests").update({ status: "negotiating" }).eq("id", request.id);
    }

    return new Response(JSON.stringify({ success: true, requestId: request.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("submit-budget-request error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
