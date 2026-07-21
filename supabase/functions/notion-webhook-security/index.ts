// Receives Notion webhook events when a human changes the Status property on
// an Approval Requests page (Approved / Rejected). On Approved, executes the
// (simulated) block action and, for malicious IPs, submits a real AbuseIPDB
// report. This is how the system finds out a human made a decision without
// polling Notion.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, notion-webhook-signature",
};

const NOTION_VERSION = "2022-06-28";
const RESPONSE_NOTION_TOKEN = Deno.env.get("RESPONSE_NOTION_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function notionFetch(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${RESPONSE_NOTION_TOKEN}`,
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

async function handleDecision(pageId: string, statusName: string) {
  const { data: incident } = await supabase
    .from("security_incidents")
    .select("*")
    .eq("notion_page_id", pageId)
    .maybeSingle();

  if (!incident) {
    console.log("No matching security_incident for Notion page", pageId);
    return;
  }

  if (statusName === "Approved" && incident.status !== "resolved") {
    await supabase.from("incident_actions").insert({
      incident_id: incident.id,
      actor: "human",
      action_type: "human_decision",
      reasoning: "Human approved the block action in Notion.",
      payload: { status: "Approved" },
      search_text: `human approved ${incident.incident_number} ${incident.source_ip}`,
    });

    // Execute the (simulated) block + real AbuseIPDB report for high-confidence threats
    let abuseReportResult: unknown = null;
    if (incident.risk_score >= 55) {
      const reportResponse = await fetch(`${SUPABASE_URL}/functions/v1/submit-abuseipdb-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify({ ip: incident.source_ip, category: incident.category }),
      });
      abuseReportResult = await reportResponse.json();
    }

    await supabase.from("incident_actions").insert({
      incident_id: incident.id,
      actor: "incident_response",
      action_type: "block_executed",
      reasoning: `Block executed for ${incident.source_ip} following human approval. (Simulated -- no real firewall connected.)`,
      payload: { abuseReportResult },
      search_text: `block executed ${incident.incident_number} ${incident.source_ip}`,
    });

    await supabase.from("security_incidents").update({ status: "resolved", decision: "block" }).eq("id", incident.id);

    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: { Status: { select: { name: "Resolved" } } } }),
    });
  } else if (statusName === "Rejected" && incident.status !== "dismissed") {
    await supabase.from("incident_actions").insert({
      incident_id: incident.id,
      actor: "human",
      action_type: "human_decision",
      reasoning: "Human rejected the block action in Notion; incident dismissed.",
      payload: { status: "Rejected" },
      search_text: `human rejected ${incident.incident_number} ${incident.source_ip}`,
    });
    await supabase.from("security_incidents").update({ status: "dismissed" }).eq("id", incident.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    if (body.verification_token) {
      console.log("Notion webhook verification token (security):", body.verification_token);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.type === "page.properties_updated" || body.type === "page.updated") {
      const pageId = body.entity?.id ?? body.data?.id;
      if (pageId) {
        const page = await notionFetch(`/pages/${pageId}`);
        const statusName = page.properties?.Status?.select?.name;
        if (statusName) await handleDecision(pageId, statusName);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notion-webhook-security error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
