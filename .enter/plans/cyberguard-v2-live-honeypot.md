# CyberGuard AI v2 — Live Attacks, XSS Honeypot, Pipeline Visualization, Groq Fallback

## Context
Extending the existing CyberGuard AI security OS (already deployed: 5-agent pipeline, real OSINT, Notion approval gate, 3D SOC floor, tabbed dashboard) with what was requested: a visibly "live" attack experience, an interactive XSS honeypot, a decoy honeypot network, and resilience against the current AI-credit outage via a fallback LLM provider. UI gets a pass to feel more like a cohesive security OS (terminal-style live log, animated pipeline tracker, refined visual language) and every new string is added to the existing i18n system (en + zh-CN).

**Constraint carried over:** edge functions run in Enter's cloud — they cannot reach a model running on your own machine ("localhost"). True local LLM (Ollama/LM Studio on your computer) is not reachable from here unless you tunnel it publicly. Given no tunnel URL was provided, I will implement a **free hosted fallback provider (Groq, OpenAI-compatible chat completions, generous free tier)** that the pipeline calls automatically whenever the primary Enter AI gateway fails (e.g. the current 402 credits-exhausted state). This directly unblocks the "local LLM" ask in the only way actually reachable from this backend. If you later expose a real local model via a public tunnel, swapping the fallback URL is a small change.

**Security:** the interactive XSS demo never executes untrusted input in the real page DOM. Submitted payloads are (1) regex-analyzed for dangerous patterns, (2) explained by an LLM agent, and (3) rendered back to the user only as **escaped, non-executing text** inside a clearly labeled "sandboxed preview" — this teaches/demonstrates the risk without introducing a real stored/reflected XSS vulnerability into the app itself.

## What gets built

### 1. Groq fallback for agent reasoning (resilience + "local/alternate LLM")
- New secret `GROQ_API_KEY` (free tier at console.groq.com — I'll ask you to obtain and provide it).
- `run-incident-pipeline`'s `callAgent()` becomes resilient: try Enter AI gateway (Gemini) first; on any failure (402 credits, timeout, non-2xx) automatically retry the same prompt against Groq's OpenAI-compatible endpoint (`https://api.groq.com/openai/v1/chat/completions`, model `llama-3.3-70b-versatile`, `response_format: { type: "json_object" }`), so the demo keeps working regardless of Enter AI credit state.
- Same fallback logic added to the new XSS-analysis function (below), sharing the same pattern (edge functions on this platform don't share imports, so the helper is duplicated per function, consistent with existing code).
- Every agent action log line will note which provider actually answered (`payload.llmProvider: "enter"|"groq"`) — keeps this traceable, not hidden.

### 2. XSS Honeypot (interactive, safe)
- New table `honeypot_events`: id, service (`ssh|admin_panel|database|rdp`), event_type (`connection_attempt|brute_force_attempt|sql_injection_attempt|xss_submission`), payload (text, nullable), source_ip, detected_pattern (text, nullable), verdict (`clean|suspicious|malicious`), incident_id (nullable FK to security_incidents), created_at. RLS: public SELECT, service-role writes, Realtime enabled.
- `security_incidents.category` check constraint extended with `xss` and `sql_injection` (additive migration).
- New edge function `analyze-xss-submission`: takes a user-submitted comment/login payload from the frontend honeypot form. Runs a regex bank against common XSS vectors (`<script>`, `onerror=`, `onload=`, `javascript:`, `<svg onload>`, `<img onerror>`, etc.) to get a fast structural verdict, then asks the Threat Detection Agent (LLM, Enter→Groq fallback) to explain in plain language what the payload would do if unescaped. Logs a `honeypot_events` row. If verdict is `suspicious`/`malicious`, also creates a real `security_incidents` row (category `xss`) and kicks off the existing `run-incident-pipeline`, so it flows through the same 5-agent → Notion approval pipeline as any other incident. Returns the escaped payload + verdict + agent explanation to the frontend — the frontend renders this as plain escaped text only (never `dangerouslySetInnerHTML`, never eval), inside a "Sandboxed Preview — not executed" panel.
- New edge function `simulate-honeypot-attack`: takes `{ service: "ssh"|"admin_panel"|"database"|"rdp", eventType }`, synthesizes a realistic attacker IP + payload (e.g. SQL injection string for the database decoy, credential-stuffing attempt for SSH/RDP), logs `honeypot_events`, creates a matching `security_incidents` row (`brute_force` for ssh/rdp, `sql_injection` for database), and runs the pipeline — this is the "attack the honeypot" button per decoy card.
- `submit-abuseipdb-report`'s category map gets `xss`/`sql_injection` → AbuseIPDB category 21 (Web App Attack).

### 3. Honeypot Network page (`/security/honeypot`)
- 4 decoy service cards, each styled like a real terminal/login banner (monospace, dark terminal look): Fake SSH (port 22 banner), Fake Admin Panel (login form — this is also where the XSS form lives), Fake Database (SQL console look), Fake RDP (port 3389 banner). Each non-admin-panel card has a "Simulate Attack" button wired to `simulate-honeypot-attack`.
- The Admin Panel decoy hosts the interactive XSS submission form (`xss-attack-form.tsx`) wired to `analyze-xss-submission`, with the sandboxed-preview result panel described above.
- A live-updating feed of recent `honeypot_events` at the bottom (Realtime), so repeated interaction visibly accumulates.

### 4. "Attack live" visualization
- `pipeline-step-tracker.tsx`: horizontal stepper — Detect → Enrich → Analyze → Decide → Approve → Resolve — color-coded per owning agent (reuses existing `agent-*` tokens), current/completed steps derived from the incident's `status` + which `incident_actions` rows already exist. Added to the top of `IncidentDetail.tsx`.
- `live-console-log.tsx`: terminal-styled, auto-scrolling, monospace log line component. Two usages: (a) inside `IncidentDetail.tsx` fed by that incident's own realtime `incident_actions` (already fetched by `useIncidentDetail`), giving a "watch the agents work" feel; (b) a compact global version on the Overview tab fed by `useAllIncidentActions` (already realtime) showing the latest actions across *all* incidents — this is what visibly shows multiple agents operating concurrently, satisfying "multi agents rakho / attack live dikhaye" together.
- `SimulateAttackButton` updated to navigate straight to the new incident's detail page on success, so the live tracker + console log are immediately visible instead of requiring a manual click-through.

### 5. UI pass
- Add a `Honeypot` tab/link in `CyberGuardDashboard.tsx` navigating to the new page (kept as a separate route rather than a tab panel, since it has real interactive forms and its own recent-activity feed — consistent with the "distinct sections, not one blob" principle already established).
- New design tokens: `--terminal-background`, `--terminal-foreground`, `--terminal-accent` (monospace console look) added to `index.css`/`tailwind.config.ts`, used only by the console-log/decoy-banner components — no hardcoded colors.
- Minor visual polish: consistent icon-badge headers across new cards, subtle scanline/glow accent on the terminal components to reinforce the "security OS" feel, without introducing a whole new design system.

### 6. i18n
- All new strings (honeypot page, decoy cards, XSS form + sandboxed preview copy, pipeline tracker step labels, console log labels, new category labels `xss`/`sql_injection`) added to both `public/locales/en.json` and `public/locales/zh-CN.json` following the existing flat-dotted-key convention. `check-i18n.mjs` + `scan-i18n.mjs` run before finishing. (Staying at 2 languages unless you want more added — easy to extend later via the same i18n skill.)

## Files
**Backend (new):** `supabase/functions/analyze-xss-submission/index.ts`, `supabase/functions/simulate-honeypot-attack/index.ts`
**Backend (edited):** `run-incident-pipeline/index.ts` (Groq fallback in `callAgent`), `submit-abuseipdb-report/index.ts` (category map)
**DB migration (new):** `honeypot_events` table + `security_incidents.category` constraint extension + Realtime
**Frontend (new):** `src/components/cyberguard/honeypot-service-card.tsx`, `xss-attack-form.tsx`, `pipeline-step-tracker.tsx`, `live-console-log.tsx`, `src/pages/HoneypotNetwork.tsx`, `src/hooks/use-security-incidents.ts` gets `useHoneypotEvents`
**Frontend (edited):** `CyberGuardDashboard.tsx` (Honeypot nav + global live feed), `IncidentDetail.tsx` (step tracker + console log), `simulate-attack-button.tsx` (navigate on success), `router.tsx` (`/security/honeypot`), `types/cyberguard.ts` (new enums/labels), `index.css`/`tailwind.config.ts` (terminal tokens), both locale files.

## Verification
- Submit a benign comment in the XSS form → verdict `clean`, no incident created, explanation shown.
- Submit `<script>alert(document.cookie)</script>` → verdict `malicious`, sandboxed preview shows the **escaped** text (confirm via browser inspection that no script executes), a real `xss` incident is created and flows through the 5-agent pipeline, visible live via the step tracker + console log.
- Click "Simulate Attack" on the Fake SSH / RDP / Database decoys → each creates a distinct incident category, runs the pipeline, and appears in the honeypot recent-activity feed.
- With Enter AI credits still exhausted, confirm the pipeline completes successfully using the Groq fallback (check `payload.llmProvider: "groq"` in the resulting `incident_actions` rows).
- Confirm the global live console feed on Overview updates as multiple simulated incidents run, showing different agents (color-coded) acting concurrently.
- Run `check-i18n.mjs` + `scan-i18n.mjs`, confirm both pass, and spot check the honeypot page + XSS form in zh-CN.
