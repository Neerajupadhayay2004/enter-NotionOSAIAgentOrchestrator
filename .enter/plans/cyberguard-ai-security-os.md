# CyberGuard AI — AI-Native Cybersecurity Enterprise OS

## Context
Pivoting the hackathon submission from the Marketing/Finance budget demo to **CyberGuard AI**, matching the Notion Track brief: an AI-native Enterprise OS where autonomous agents run a business function (here: cybersecurity), a human approves high-risk actions, and every decision is traceable in Notion. We keep the existing budget-negotiation app as a second section (nav switcher) rather than deleting it — it already proves the "agents coordinate + human approval + traceability" pattern and costs nothing to keep.

**Security note:** The Shodan, AbuseIPDB, and VirusTotal keys pasted in chat will be stored ONLY via the encrypted secrets tool (`supabase_add_secret`), never hardcoded. The Google API key and Convex credentials shared earlier are not used — this platform doesn't support Convex, and LLM calls go through Enter's built-in AI capability (already configured, using Gemini 3.5 Flash, same as the budget app).

**Platform constraints:** No Next.js/FastAPI/Docker/Vercel/Railway — everything is Vite+React+TS+Tailwind (frontend) and Supabase Edge Functions/Postgres/Realtime (backend), consistent with the existing app. Suricata/Zeek/YARA are physical network tools that cannot run in edge functions — threat *events* are realistically simulated (seeded generator), but every OSINT enrichment call (Shodan, AbuseIPDB, VirusTotal, AlienVault OTX) is a **real, live API call** with real evidence returned and shown to the user.

## Decisions (defaults used, confirm or I'll adjust after building)
- Keep both apps; add a top-level switcher (e.g. `/` = CyberGuard OS, `/budget-os` = existing Marketing/Finance demo, linked via a small app-switcher control in the header).
- 4th OSINT source: **AlienVault OTX** (free API key, threat intel pulses) — normalized into the same evidence-card/risk-score shape as the other 3. User will need to obtain and provide this key via secrets.
- Notion access control: **3 integration tokens** — `DETECTION_NOTION_TOKEN` (Threat Detection + Malware Analysis agents, incident pages only), `RESPONSE_NOTION_TOKEN` (Incident Response agent, incident + playbook/policy pages), `COMPLIANCE_NOTION_TOKEN` (Compliance & Audit agent, read-all + writes audit log). This mirrors the real Marketing/Finance boundary pattern already proven in this project.
- "Blocking an IP": simulated authoritative action logged with full reasoning in DB + Notion (clearly labeled "Simulated — no real firewall connected"), AND for high-confidence malicious IPs we also submit a **real AbuseIPDB report** (`POST /report`) as the one real external side-effect, so the action isn't purely cosmetic.

## Architecture

### Agents (5, matching the brief)
1. **Threat Detection Agent** — ingests a simulated network/security event stream, decides if it's a real threat, assigns initial severity, requests OSINT enrichment.
2. **Malware Analysis Agent** — for file-hash-bearing incidents, queries VirusTotal (+ AlienVault OTX) for the hash, produces a malware verdict + confidence.
3. **Incident Response Agent** — combines Detection + Malware verdicts, decides block/monitor/ignore. If risk is high, creates a Notion approval request instead of acting immediately (this is the human-in-the-loop gate). On approval, executes the (simulated + AbuseIPDB-real) block action.
4. **Compliance & Audit Agent** — passively logs every action any agent takes into an immutable audit trail (DB + Notion database), independent of the other agents, so a human can always answer "what happened and why" without asking the agents. Owns the searchable Audit Log.
5. **Human Approval Agent** — not an AI agent; represented as the human-in-the-loop step. The dashboard's "Pending Approvals" panel + Notion is where a real human approves/rejects. A webhook (same pattern as `notion-webhook`) or manual "Check Notion" sync detects the decision and lets Incident Response continue.

### Orchestration flow (one incident, end to end)
1. `generate-threat-event` (edge function, called on a timer from the frontend or a "Simulate Attack" button) creates a `security_incidents` row from a realistic template (port scan, brute force, malware beacon, DDoS, phishing callback, etc.) with a source IP and optionally a file hash.
2. `run-incident-pipeline` (edge function, the orchestrator):
   - Threat Detection Agent (LLM) reviews the raw event → severity + reasoning → logs `detect`.
   - OSINT enrichment step: calls Shodan (`/shodan/host/{ip}`), AbuseIPDB (`/check`), VirusTotal (`/ip_addresses/{ip}` and, if a hash exists, `/files/{hash}`), AlienVault OTX (`/indicators/IPv4/{ip}/general`) — in parallel, normalized into one `EvidenceCard[]` shape: `{source, verdict, score, summary, raw}`.
   - Malware Analysis Agent (LLM, only if a hash is present) reviews VT/OTX file evidence → malware verdict + confidence → logs `analyze`.
   - Incident Response Agent (LLM) combines everything → decision `monitor | block | escalate`. If `escalate` (high risk), creates a Notion "Approval Request" page (Response token) and sets incident status `pending_approval` — pipeline stops here and waits.
   - If `monitor` or auto-approved low-risk `block`, executes immediately (still logged) and status becomes `resolved`.
   - Compliance & Audit Agent writes every step above into `audit_log` (DB) AND into a Notion "Audit Log" database (Compliance token) as it happens — not as an afterthought.
3. Human reviews the Notion approval page, sets Status = Approved/Rejected.
4. `notion-webhook-security` (new edge function, same webhook + manual-sync-fallback pattern as the budget app) detects the decision, and:
   - Approved → Incident Response executes the block (simulated + real AbuseIPDB report submission for high-confidence IPs), status → `resolved`, Notion Approval page updated with outcome + link.
   - Rejected → status → `dismissed`, reasoning logged.
5. Everything above is visible live via Supabase Realtime — no polling needed for the dashboard.

### Data model (new tables, additive — doesn't touch existing `budget_requests`/`agent_actions`)
- `security_incidents`: id, incident_number (human-friendly, e.g. INC-0001), title, category (port_scan|brute_force|malware|ddos|phishing|c2_beacon), source_ip, file_hash, severity (low|medium|high|critical), risk_score (0-100), status (detected|analyzing|pending_approval|resolved|dismissed), decision (monitor|block|none), notion_page_id, notion_url, created_at, updated_at.
- `incident_evidence`: id, incident_id (FK), source (shodan|abuseipdb|virustotal|alienvault_otx), verdict (clean|suspicious|malicious|unknown), score (numeric, normalized 0-100), summary (text, human-readable), raw_response (jsonb), created_at. This is the "evidence card" backing store.
- `incident_actions` (audit trail, mirrors `agent_actions` shape): id, incident_id (FK), actor (threat_detection|malware_analysis|incident_response|compliance|human|system), action_type (detect|enrich|analyze|decide|escalate|human_decision|block_executed|notion_synced|error), reasoning (text), payload (jsonb), created_at. Full-text search will be built on `reasoning` + a generated `search_text` column combining incident_number/source_ip/file_hash/actor for the Audit Log search/filter requirement.
- `agent_status` (small live table): agent_name (PK), state (idle|working|blocked), last_active_at, current_incident_id — powers the "AI Agents Status" dashboard panel so agents visibly show what they're doing, not just one aggregate view.
- RLS: public SELECT (same posture as existing tables, no auth requested); all writes via edge functions with service role.
- Realtime enabled on `security_incidents`, `incident_evidence`, `incident_actions`, `agent_status`.

### Edge Functions (new)
- `simulate-threat-event`: creates one realistic incident (random template) and kicks off the pipeline. Also usable on an interval from the frontend for a "live" feel.
- `run-incident-pipeline`: the orchestrator described above (detection → enrichment → malware analysis → response decision → Notion sync or auto-resolve). Includes the same idempotency guard + fetch timeouts + traceable `error` action logging pattern already proven in `run-negotiation`.
- `osint-lookup` (internal helper, called by the pipeline): wraps the 4 OSINT APIs behind one normalized interface; used by both the pipeline and (optionally) an on-demand "re-check evidence" button in the incident detail view.
- `notion-webhook-security`: receives Notion webhook events for the Approval Requests DB (Response token), same verification-token handshake + property-change detection as `notion-webhook`.
- `notion-sync-security-status`: manual pull fallback, same resilience pattern as `notion-sync-status`.
- `submit-abuseipdb-report`: called only when Incident Response executes an approved block on a high-confidence malicious IP — the one real external side effect beyond Notion.

### Notion setup (3 new databases, 3 new integration tokens — user will need to create these; I'll give exact steps like before)
- **Security Incidents** DB: Title, Category(select), Severity(select), Risk Score(number), Source IP(text), File Hash(text), Status(select: Detected/Analyzing/Pending Approval/Resolved/Dismissed), Decision(select), Evidence Summary(text), Incident #(text).
- **Approval Requests** DB: linked/duplicated fields from Incidents + Status(select: Pending/Approved/Rejected) — this is the human-in-the-loop gate page.
- **Audit Log** DB: Timestamp, Agent(select), Action(text), Incident #(text), Summary(text) — the durable, searchable trail a new team member reads first.
- Sharing: Detection token → Incidents DB only. Response token → Incidents + Approval Requests DB. Compliance token → all three (read-all, writes Audit Log) — mirrors real least-privilege.

### Frontend — "full web OS" requirement (distinct, clearly-separated sections, not one blob)
New top-level `/security` route (or becomes `/` per nav-switcher decision) with sub-sections as separate, clearly delineated panels/tabs so it reads like a real OS, not a single dumped page:
1. **Overview Dashboard** — system health, active incident count, risk gauge, 3D "SOC floor" scene (reuse/extend the `office-scene.tsx` pattern: 5 agent stations + human approval station, live pulse beams driven by real `agent_status`/incident counts instead of budget counts).
2. **Live Threat Map** — world-ish grid or list view of active incidents with source IP, severity color, live-updating via Realtime.
3. **Active Incidents** — list + detail drill-in (reuses the `RequestDetail`-style timeline pattern, renamed to Incident Timeline) showing every agent action in order with reasoning.
4. **Evidence / OSINT panel** — per-incident evidence cards, one per OSINT source, normalized layout: source logo/name, verdict badge, score, summary, "view raw" expandable, with a manual "Re-check evidence" action.
5. **Pending Human Approvals** — dedicated queue view of `pending_approval` incidents with quick "View in Notion" + simulated local Approve/Reject shortcut that just deep-links to Notion (keeps the real approval authority in Notion, per the brief's "don't route real approvals around Notion" spirit) — actually, simplest correct approach: this panel shows the queue and its Notion link only; real decision always happens in Notion, consistent with human-in-the-loop requirement.
6. **Agents Status** — 5 live agent cards (state, last active, current incident) reading from `agent_status`.
7. **Audit Log & Notion Workflow viewer** — searchable/filterable (by IP, hash, incident #, agent name — the explicit ask) table over `incident_actions`, plus a "View full workflow in Notion" link. Search implemented via a Postgres `ilike`/full-text query edge function or direct Supabase client query with `.or()` filters — no need for a separate search service.
8. **Blocked IPs / Risk Score / System Health** — small stat widgets pulling aggregates from the incident tables (counts by status/severity, blocked IP list from `decision = 'block'` incidents).

Each of these is its own component under `src/components/cyberguard/`, composed on one dashboard page via tabs or a sidebar-nav layout (shadcn `Tabs` or a simple left nav) — explicitly addressing "multiple agents dikhao ek hi me sab na dikhao" (show them as distinct sections, not crammed into one view).

### Design system additions
- New status/severity/verdict badge variants in `badge.tsx` (critical/high/medium/low severity; clean/suspicious/malicious verdict) using new CSS tokens in `index.css`/`tailwind.config.ts` (`--severity-critical`, `--verdict-malicious`, etc.) — same token-driven approach already used for budget statuses, no hardcoded colors.
- i18n: every new string goes through the existing `en.json`/`zh-CN.json` + `t()` pattern already established; run `check-i18n.mjs` + `scan-i18n.mjs` before finishing.

### App-level navigation
- Add a small switcher in a shared header/nav component: "CyberGuard AI (Security OS)" vs "Enterprise Budget OS" — two clearly separate experiences, not merged.
- Router gets new routes: `/security` (dashboard), `/security/incidents/:id` (incident detail). Existing `/` and `/requests/:id` stay as-is (or get moved to `/budget-os` and `/budget-os/requests/:id` per the switcher decision — final paths confirmed during build).

## Build order
1. Secrets: collect `SHODAN_API_KEY`, `ABUSEIPDB_API_KEY`, `VIRUSTOTAL_API_KEY` (already pasted by user, will be collected via `supabase_add_secret` prompts, never hardcoded), plus guide user to get `ALIENVAULT_OTX_API_KEY` (free signup) and the 3 new Notion tokens + 3 new Notion DB IDs.
2. DB migration: create `security_incidents`, `incident_evidence`, `incident_actions`, `agent_status`, enable RLS + Realtime.
3. Edge functions: `osint-lookup` helper logic embedded directly in `run-incident-pipeline` (edge functions are single-file, no shared imports across functions on this platform — confirmed from the budget app's pattern of duplicating helpers per function) — build `simulate-threat-event`, `run-incident-pipeline`, `notion-webhook-security`, `notion-sync-security-status`, `submit-abuseipdb-report`.
4. Frontend: design tokens → shared components (severity/verdict badges, evidence card, agent status card) → 8 dashboard sections → routes → nav switcher → 3D SOC scene.
5. i18n pass + validation scripts.
6. End-to-end test: trigger simulated incident, verify OSINT calls return real data, verify Notion approval page created, verify webhook/manual-sync resolves it, verify AbuseIPDB report fires on approved high-confidence block, verify audit log search works by IP/hash/incident#/agent.

## Verification
- Submit/simulate a low-risk incident → auto-resolves without human approval, fully logged.
- Simulate a high-risk incident (malicious IP + malware hash) → Notion Approval page created with real OSINT evidence summarized (not raw dumps) → approve in Notion → webhook or manual sync fires → simulated block executes → real AbuseIPDB report confirmed sent (check response) → Notion page updated to Resolved with outcome.
- Confirm Detection/Malware token cannot read the Approval Requests or Audit Log DBs (Notion sharing boundary) — real access control, not just app-layer.
- Confirm Audit Log search filters correctly by IP, hash, incident number, and agent name.
- Confirm dashboard shows 5 distinct agent sections + overview + evidence + approvals + audit log as separate, navigable panels (not one page).
- Confirm nav switcher moves cleanly between CyberGuard OS and the existing Budget OS without breaking either.
