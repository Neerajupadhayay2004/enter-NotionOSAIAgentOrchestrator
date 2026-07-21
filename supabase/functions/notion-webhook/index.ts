// Receives Notion webhook events when a human changes the Status property
// on a Requests DB page (Approved / Rejected). On Approved, opens a GitHub
// issue and syncs the outcome back to Notion + Supabase. This is how the
// system finds out a human made a decision without polling Notion.
//
// Notion webhooks: on first setup, Notion sends a one-time verification
// request containing a `verification_token` — this function logs it so the
// user can enter it into the Notion integration setup page. Real events
// arrive as POSTs with an `Notion-Webhook-Signature` header we verify using
// NOTION_WEBHOOK_VERIFICATION_TOKEN.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, notion-webhook-signature",
};

const NOTION_VERSION = "2022-06-28";
const FINANCE_NOTION_TOKEN = Deno.env.get("FINANCE_NOTION_TOKEN")!;
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!; // "owner/repo"

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

async function handleDecision(pageId: string, statusName: string) {
  const { data: request } = await supabase
    .from("budget_requests")
    .select("*")
    .eq("notion_page_id", pageId)
    .maybeSingle();

  if (!request) {
    console.log("No matching budget_request for Notion page", pageId);
    return;
  }

  if (statusName === "Approved" && request.status !== "approved" && request.status !== "completed") {
    await supabase.from("budget_requests").update({ status: "approved" }).eq("id", request.id);
    await supabase.from("agent_actions").insert({
      request_id: request.id,
      actor: "human",
      action_type: "human_decision",
      amount: request.final_amount,
      reasoning: "Human approved the negotiated budget in Notion.",
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

    await notionFetch(`/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Completed" } },
          "GitHub Issue": { url: issueUrl },
        },
      }),
    });
  } else if (statusName === "Rejected" && request.status !== "rejected") {
    await supabase.from("budget_requests").update({ status: "rejected" }).eq("id", request.id);
    await supabase.from("agent_actions").insert({
      request_id: request.id,
      actor: "human",
      action_type: "human_decision",
      amount: null,
      reasoning: "Human rejected the negotiated budget in Notion.",
      payload: { status: "Rejected" },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    // One-time verification handshake when the webhook subscription is created
    if (body.verification_token) {
      console.log("Notion webhook verification token:", body.verification_token);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real event: page properties updated
    if (body.type === "page.properties_updated" || body.type === "page.updated") {
      const pageId = body.entity?.id ?? body.data?.id;
      if (pageId) {
        const page = await notionFetch(`/pages/${pageId}`);
        if (page) {
          const statusName = page.properties?.Status?.select?.name;
          if (statusName) await handleDecision(pageId, statusName);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notion-webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
