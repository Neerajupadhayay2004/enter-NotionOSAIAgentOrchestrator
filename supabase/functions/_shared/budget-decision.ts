import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const NOTION_VERSION = "2022-06-28";
const FINANCE_NOTION_TOKEN = Deno.env.get("FINANCE_NOTION_TOKEN") ?? "";
const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN");
const GITHUB_REPO = Deno.env.get("GITHUB_REPO");

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function notionFetch(path: string, init?: RequestInit) {
  if (!FINANCE_NOTION_TOKEN) {
    console.info("FINANCE_NOTION_TOKEN not configured — skipping Notion sync (non-blocking)");
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
      // Log but NEVER throw — Notion is an optional mirror, not the source of truth
      console.warn(`Notion API error (${response.status}) — continuing without Notion sync`);
      return null;
    }
    return response.json();
  } catch (err) {
    console.warn("Notion API call failed — continuing without Notion sync:", err);
    return null;
  }
}

async function createGithubIssue(title: string, body: string): Promise<string> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new Error("GitHub integration is not configured");
  }
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

export async function applyBudgetDecision(
  supabase: SupabaseClient,
  requestId: string,
  decision: "approve" | "reject",
  options: { notes?: string; source?: string } = {},
) {
  const { data: request, error } = await supabase
    .from("budget_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error || !request) throw new Error("Budget request not found");

  const allowedStatuses = ["pending_approval", "negotiating", "approved", "completed"];
  if (!allowedStatuses.includes(request.status)) {
    throw new Error(`Cannot ${decision} request in status "${request.status}"`);
  }

  const source = options.source ?? "in-app";
  const notes = options.notes?.trim();

  if (decision === "approve") {
    // Immediately mark as approved in Supabase (source of truth)
    await supabase.from("budget_requests").update({ status: "approved" }).eq("id", request.id);
    await supabase.from("agent_actions").insert({
      request_id: request.id,
      actor: "human",
      action_type: "human_decision",
      amount: request.final_amount ?? request.requested_amount,
      reasoning: notes || `Human approved the negotiated budget (${source}).`,
      payload: { status: "Approved", source, notes: notes ?? null },
    });

    let issueUrl: string | null = null;
    try {
      issueUrl = await createGithubIssue(
        `[Budget Approved] ${request.campaign_name}`,
        [
          `**Category:** ${request.category}`,
          `**Approved amount:** $${request.final_amount ?? request.requested_amount}`,
          `**Requested by:** ${request.requested_by}`,
          "",
          `**Justification:** ${request.justification}`,
          notes ? `**Approver notes:** ${notes}` : "",
          "",
          `Approved via ${source}. See: ${request.notion_url ?? ""}`,
        ].filter(Boolean).join("\n"),
      );
    } catch (githubError) {
      console.warn("GitHub issue creation failed (non-blocking):", githubError);
    }

    // Mark as completed in Supabase
    await supabase.from("budget_requests").update({
      status: "completed",
      github_issue_url: issueUrl,
    }).eq("id", request.id);

    if (issueUrl) {
      await supabase.from("agent_actions").insert({
        request_id: request.id,
        actor: "system",
        action_type: "github_issue_created",
        amount: null,
        reasoning: "Approved budget automatically turned into a GitHub issue for execution.",
        payload: { github_issue_url: issueUrl },
      });
    }

    // Sync to Notion (optional — never block on this)
    if (request.notion_page_id) {
      await notionFetch(`/pages/${request.notion_page_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: {
            Status: { select: { name: "Completed" } },
            ...(issueUrl ? { "GitHub Issue": { url: issueUrl } } : {}),
            ...(notes ? {
              "Decision Notes": {
                rich_text: [{ text: { content: `Approved (${source}): ${notes.slice(0, 1800)}` } }],
              },
            } : {}),
          },
        }),
      });
    }

    return { status: "completed" as const, githubIssueUrl: issueUrl };
  }

  // REJECT path
  await supabase.from("budget_requests").update({ status: "rejected" }).eq("id", request.id);
  await supabase.from("agent_actions").insert({
    request_id: request.id,
    actor: "human",
    action_type: "human_decision",
    amount: null,
    reasoning: notes || `Human rejected the negotiated budget (${source}).`,
    payload: { status: "Rejected", source, notes: notes ?? null },
  });

  // Sync to Notion (optional — never block on this)
  if (request.notion_page_id) {
    await notionFetch(`/pages/${request.notion_page_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          Status: { select: { name: "Rejected" } },
          ...(notes ? {
            "Decision Notes": {
              rich_text: [{ text: { content: `Rejected (${source}): ${notes.slice(0, 1800)}` } }],
            },
          } : {}),
        },
      }),
    });
  }

  return { status: "rejected" as const, githubIssueUrl: null };
}
