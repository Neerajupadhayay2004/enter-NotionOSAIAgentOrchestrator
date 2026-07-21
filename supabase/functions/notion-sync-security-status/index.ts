// Manual pull fallback: given an incident id, fetches its Notion approval
// page's current Status directly and reconciles local Supabase state exactly
// like the webhook would. Used by the dashboard as a resilience backup in
// case a webhook delivery is missed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { incidentId } = await req.json();
    if (!incidentId) throw new Error("incidentId is required");

    const { data: incident, error } = await supabase
      .from("security_incidents")
      .select("*")
      .eq("id", incidentId)
      .single();
    if (error || !incident) throw new Error("Incident not found");
    if (!incident.notion_page_id) {
      return new Response(JSON.stringify({ synced: false, reason: "No Notion page yet" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const page = await notionFetch(`/pages/${incident.notion_page_id}`);
    const statusName = page.properties?.Status?.select?.name;

    if (statusName === "Approved" && incident.status !== "resolved") {
      await supabase.from("incident_actions").insert({
        incident_id: incident.id,
        actor: "human",
        action_type: "human_decision",
        reasoning: "Human approved the block action in Notion (detected via manual sync).",
        payload: { status: "Approved" },
        search_text: `human approved ${incident.incident_number} ${incident.source_ip}`,
      });

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

      await notionFetch(`/pages/${incident.notion_page_id}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { Status: { select: { name: "Resolved" } } } }),
      });

      return new Response(JSON.stringify({ synced: true, status: "resolved", abuseReportResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (statusName === "Rejected" && incident.status !== "dismissed") {
      await supabase.from("incident_actions").insert({
        incident_id: incident.id,
        actor: "human",
        action_type: "human_decision",
        reasoning: "Human rejected the block action in Notion (detected via manual sync); incident dismissed.",
        payload: { status: "Rejected" },
        search_text: `human rejected ${incident.incident_number} ${incident.source_ip}`,
      });
      await supabase.from("security_incidents").update({ status: "dismissed" }).eq("id", incident.id);
      return new Response(JSON.stringify({ synced: true, status: "dismissed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ synced: false, status: incident.status, notionStatus: statusName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notion-sync-security-status error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
