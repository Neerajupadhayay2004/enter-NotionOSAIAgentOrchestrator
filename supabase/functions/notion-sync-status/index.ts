// Manual pull fallback: given a request id, fetches its Notion page's current
// Status directly and reconciles local Supabase state exactly like the
// webhook would. Used by the dashboard as a resilience backup in case a
// webhook delivery is missed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_VERSION = "2022-06-28";
const FINANCE_NOTION_TOKEN = Deno.env.get("FINANCE_NOTION_TOKEN")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function notionFetch(path: string, init?: RequestInit) {
  if (!FINANCE_NOTION_TOKEN) {
    console.warn("FINANCE_NOTION_TOKEN not configured, skipping Notion sync");
    return null;
  }
  try {
    const response = await fetch(`https://api.notion.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${FINANCE_NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      console.warn(`Notion API error (${response.status}), skipping Notion sync`);
      return null;
    }
    return response.json();
  } catch (err) {
    console.warn("Notion API call failed, continuing without Notion:", err);
    return null;
  }
}

async function createGithubIssue(title: string, body: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body }),
  });
  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }
  const issue = await response.json();
  return issue.html_url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { requestId } = await req.json();
    if (!requestId) throw new Error("requestId is required");

    const { data: request, error } = await supabase
      .from("budget_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (error || !request) throw new Error("Budget request not found");
    if (!request.notion_page_id) {
      return new Response(JSON.stringify({ synced: false, reason: "No Notion page configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const page = await notionFetch(`/pages/${request.notion_page_id}`);
    if (!page) {
      return new Response(JSON.stringify({ synced: false, reason: "Notion unavailable, decision recorded in-app" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const statusName = page.properties?.Status?.select?.name;

    if (statusName === "Approved" && request.status !== "approved" && request.status !== "completed") {
      await supabase.from("budget_requests").update({ status: "approved" }).eq("id", request.id);
      await supabase.from("agent_actions").insert({
        request_id: request.id,
        actor: "human",
        action_type: "human_decision",
        amount: request.final_amount,
        reasoning: "Human approved the negotiated budget in Notion (detected via manual sync).",
        payload: { status: "Approved" },
      });

      const issueUrl = await createGithubIssue(
        `[Budget Approved] ${request.campaign_name}`,
        [
          `**Category:** ${request.category}`,
          `**Approved amount:** $${request.final_amount}`,
          `**Requested by:** ${request.requested_by}`,
          "",
          `**Justification:** ${request.justification}`,
          "",
          `Approved via Notion. See: ${request.notion_url ?? ""}`,
        ].join(String.fromCharCode(10)),
      );

      await supabase.from("budget_requests").update({
        status: "completed",
        github_issue_url: issueUrl,
      }).eq("id", request.id);

      await supabase.from("agent_actions").insert({
        request_id: request.id,
        actor: "system",
        action_type: "github_issue_created",
        amount: null,
        reasoning: "Approved budget automatically turned into a GitHub issue for execution.",
        payload: { github_issue_url: issueUrl },
      });

      await notionFetch(`/pages/${request.notion_page_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            Status: { select: { name: "Completed" } },
            "GitHub Issue": { url: issueUrl },
          },
        }),
      });

      return new Response(JSON.stringify({ synced: true, status: "completed", githubIssueUrl: issueUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (statusName === "Rejected" && request.status !== "rejected") {
      await supabase.from("budget_requests").update({ status: "rejected" }).eq("id", request.id);
      await supabase.from("agent_actions").insert({
        request_id: request.id,
        actor: "human",
        action_type: "human_decision",
        amount: null,
        reasoning: "Human rejected the negotiated budget in Notion (detected via manual sync).",
        payload: { status: "Rejected" },
      });
      return new Response(JSON.stringify({ synced: true, status: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ synced: false, status: request.status, notionStatus: statusName }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notion-sync-status error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
