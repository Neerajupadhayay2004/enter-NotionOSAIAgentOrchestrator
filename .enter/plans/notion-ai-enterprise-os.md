# AI-Native Enterprise OS — Marketing ⇄ Finance (Notion Track)

## Context
Hackathon requires: (1) ≥2 agents coordinating autonomously with a real disagreement, (2) a human-in-the-loop approval gate, (3) full traceability of every agent action, (4) Notion as durable system of record (not a message bus), (5) real external action firing after approval. We go deep on **2 agents** (Marketing, Finance) instead of building shallow department stubs.

**Workflow to build:** Marketing agent proposes a campaign budget → Finance agent checks it against a policy limit read from Notion → if over limit, Finance pushes back with a counter-offer + reasoning → Marketing revises or justifies (bounded to 2 rounds) → once agents converge, a Notion page is created summarizing the negotiation and set to "Pending Approval" → a human flips the Decision status in Notion → our system detects it (webhook + manual sync fallback) → on Approval, a GitHub issue is created automatically and linked back to the Notion page → every step is logged immutably and viewable in-app without asking the agents.

## Stack notes
- No Convex — this platform only supports **Enter Cloud** (managed Supabase: Postgres + Edge Functions + Realtime) for backend/orchestrator state.
- No pasted Gemini key — LLM calls go through Enter's **built-in AI capability** (`enable_ai_capability`), used from Edge Functions via the `enter_llm_integration` skill.
- Runtime negotiation state lives in Supabase Postgres. Durable org state (decisions, policy, history a human/new teammate would read) lives in Notion.

## Build order

### 0. Enable infra (first execution step)
- `supabase_enable` (Enter Cloud)
- `enable_ai_capability` (Marketing + Finance agent reasoning)
- Guide user to create Notion setup (see "Notion setup" below) and collect secrets via `supabase_add_secret`:
  - `MARKETING_NOTION_TOKEN`, `FINANCE_NOTION_TOKEN`
  - `NOTION_REQUESTS_DB_ID`, `NOTION_POLICIES_DB_ID`
  - `GITHUB_TOKEN`, `GITHUB_REPO` (owner/repo)
  - `NOTION_WEBHOOK_VERIFICATION_TOKEN` (produced by Notion when the webhook subscription is created)

### 1. Notion setup (user does this, I provide exact steps/screenshots-in-words)
- Two databases in the user's workspace:
  - **Requests**: Name(title), Category(select), Requested Amount(number), Approved Amount(number), Status(select: Negotiating/Pending Approval/Approved/Rejected/Completed), Decision Notes(text), GitHub Issue(url), Requested By(text), Last Updated(last edited time).
  - **Policies**: Category(title), Monthly Limit(number), Requires Approval Above(number), Notes(text). Seed 2-3 rows (e.g. Paid Ads $5000, Events $2000).
- Two internal integrations at notion.so/my-integrations: "Marketing Agent" and "Finance Agent" → copy each token.
- **Access control (real, not simulated):** share **Requests** DB with both integrations; share **Policies** DB with the Finance integration ONLY. Marketing's token physically cannot read policy limits — it only knows the limit because Finance tells it during negotiation. This is enforced by Notion sharing, not app logic.
- Add a webhook subscription (on the Finance integration) pointing at the deployed `notion-webhook` edge function URL, subscribed to page property update events on the Requests DB.

### 2. Database schema (Supabase Postgres, via migration)
- `budget_requests`: id, campaign_name, category, requested_amount, final_amount, justification, status (negotiating|pending_approval|approved|rejected|completed), notion_page_id, github_issue_url, created_at, updated_at.
- `agent_actions` (immutable audit log): id, request_id (FK), actor (marketing|finance|human|system), action_type (propose|review|counter|accept|escalate|human_decision|notion_synced|github_issue_created), amount, reasoning (text), payload (jsonb), created_at.
- RLS: public read for demo dashboard (no auth requested); writes only via edge functions using service role.
- Enable Realtime on both tables so the dashboard updates live as agents negotiate.

### 3. Edge Functions (Deno, `supabase/functions/`)
- `submit-budget-request`: creates `budget_requests` row, then invokes the orchestrator logic (can be inline or call `run-negotiation`).
- `run-negotiation`: the orchestrator loop —
  1. Marketing agent (LLM call) drafts/refines the proposal + justification → log `propose`.
  2. Finance agent fetches the relevant Policies row from Notion (live GET, single request — well within rate limits), LLM reasons whether request is within limit → log `review`.
  3. If over limit: Finance LLM produces a counter amount + reasoning → log `counter`. Marketing LLM decides to accept the counter or justify the original ask once more → log `accept` or `escalate`. Max 2 rounds, then settle on Finance's number if unresolved.
  4. Create the Notion page in Requests DB (using Finance's token, since it's the approver of record) with a clear title, statuses, and a short human-readable reasoning summary (never raw model dump) → log `notion_synced`. Set `budget_requests.status = pending_approval`.
- `notion-webhook`: public endpoint. Verifies Notion's signature/verification token, reads the updated Status property, writes a `human_decision` action to `agent_actions`, updates `budget_requests.status`. If Approved → calls GitHub API to open an issue, writes `github_issue_created` action, patches the Notion page with the issue URL and Status=Completed.
- `notion-sync-status`: manual pull fallback — given a request id, fetches the Notion page's current Status directly and reconciles local state the same way the webhook would. Called by the dashboard on demand / light polling while a request is open, as a resilience backup to the webhook.

### 4. Frontend (`src/pages/`, small focused components)
- **New Request** view: form for campaign name, category, amount, justification → calls `submit-budget-request`.
- **Request Timeline** view: renders the `agent_actions` log for a request as a chronological negotiation transcript (who said what, amount, reasoning), live via Supabase Realtime; shows current status badge, a "View in Notion" link, and (once resolved) the GitHub issue link.
- **Dashboard/list** view: all requests with status, so it reads like a legible mini "org" — pending vs. resolved at a glance.
- Design: reuse existing shadcn tokens in `index.css`/`tailwind.config.ts`; add a small status-badge variant set (negotiating/pending/approved/rejected) rather than ad-hoc colors.

### 5. Verification
- Submit a request under a category's limit → confirm single-round agreement, Notion page created as Pending Approval, no pushback logged.
- Submit a request over a category's limit → confirm Finance counter + Marketing response logged, final negotiated amount recorded, Notion page reflects it.
- Flip Status to Approved in Notion → confirm webhook (or manual sync) updates Supabase, GitHub issue appears in the configured repo, Notion page shows the issue link and Status=Completed.
- Flip Status to Rejected on another request → confirm it stops cleanly with no GitHub action and the reasoning is visible in the timeline.
- Open the Request Timeline for any request and confirm a human can see every action, actor, and reasoning without needing to ask the agents.
