// Threat Detection Agent -> OSINT Enrichment -> Malware Analysis Agent ->
// Incident Response Agent -> (Notion approval gate) -> Compliance & Audit log.
//
// Runtime pipeline state lives here + in security_incidents/incident_actions.
// Durable organizational state (the record a human/new teammate reads) is
// written to Notion as the pipeline progresses. Notion is never used as a
// message bus between agents -- only outcomes and approval requests go there.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_API_TOKEN = Deno.env.get("AI_API_TOKEN_af4c304323bc")!;
const AI_MODEL = "google/gemini-3.5-flash";
const AI_BASE = "https://api.enter.pro/code/api/ai/v1beta/models";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const NOTION_VERSION = "2022-06-28";
const FETCH_TIMEOUT_MS = 20000;

const SHODAN_API_KEY = Deno.env.get("SHODAN_API_KEY") ?? "";
const ABUSEIPDB_API_KEY = Deno.env.get("ABUSEIPDB_API_KEY") ?? "";
const VIRUSTOTAL_API_KEY = Deno.env.get("VIRUSTOTAL_API_KEY") ?? "";
const ALIENVAULT_OTX_API_KEY = Deno.env.get("ALIENVAULT_OTX_API_KEY") ?? "";

const DETECTION_NOTION_TOKEN = Deno.env.get("DETECTION_NOTION_TOKEN") ?? "";
const RESPONSE_NOTION_TOKEN = Deno.env.get("RESPONSE_NOTION_TOKEN") ?? "";
const COMPLIANCE_NOTION_TOKEN = Deno.env.get("COMPLIANCE_NOTION_TOKEN") ?? "";
const NOTION_INCIDENTS_DB_ID = Deno.env.get("NOTION_INCIDENTS_DB_ID") ?? "";
const NOTION_APPROVALS_DB_ID = Deno.env.get("NOTION_APPROVALS_DB_ID") ?? "";
const NOTION_AUDIT_LOG_DB_ID = Deno.env.get("NOTION_AUDIT_LOG_DB_ID") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface EvidenceCard {
  source: "shodan" | "abuseipdb" | "virustotal" | "alienvault_otx";
  verdict: "clean" | "suspicious" | "malicious" | "unknown";
  score: number;
  summary: string;
  raw: unknown;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------- OSINT normalization: 4 sources -> 1 EvidenceCard shape ----------

async function lookupShodan(ip: string): Promise<EvidenceCard> {
  try {
    if (!SHODAN_API_KEY) return { source: "shodan", verdict: "unknown", score: 0, summary: "Shodan API key not configured.", raw: null };
    const res = await fetchWithTimeout(`https://api.shodan.io/shodan/host/${ip}?key=${SHODAN_API_KEY}`);
    if (res.status === 404) {
      return { source: "shodan", verdict: "clean", score: 5, summary: "No exposed services indexed by Shodan for this host.", raw: null };
    }
    if (!res.ok) throw new Error(`Shodan HTTP ${res.status}`);
    const data = await res.json();
    const ports: number[] = data.ports ?? [];
    const vulnCount = data.vulns ? Object.keys(data.vulns).length : 0;
    const score = Math.min(100, ports.length * 5 + vulnCount * 15);
    const verdict = vulnCount > 0 ? "malicious" : ports.length > 5 ? "suspicious" : "clean";
    return {
      source: "shodan",
      verdict,
      score,
      summary: `${ports.length} open port(s) [${ports.slice(0, 8).join(", ")}], ${vulnCount} known vuln(s). Org: ${data.org ?? "unknown"}.`,
      raw: data,
    };
  } catch (err) {
    return { source: "shodan", verdict: "unknown", score: 0, summary: `Shodan lookup failed: ${(err as Error).message}`, raw: null };
  }
}

async function lookupAbuseIPDB(ip: string): Promise<EvidenceCard> {
  try {
    if (!ABUSEIPDB_API_KEY) return { source: "abuseipdb", verdict: "unknown", score: 0, summary: "AbuseIPDB API key not configured.", raw: null };
    const res = await fetchWithTimeout(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`, {
      headers: { Key: ABUSEIPDB_API_KEY, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`AbuseIPDB HTTP ${res.status}`);
    const data = await res.json();
    const score = data.data?.abuseConfidenceScore ?? 0;
    const reports = data.data?.totalReports ?? 0;
    const verdict = score >= 70 ? "malicious" : score >= 25 ? "suspicious" : "clean";
    return {
      source: "abuseipdb",
      verdict,
      score,
      summary: `Abuse confidence ${score}%, ${reports} report(s), country ${data.data?.countryCode ?? "?"}, ISP: ${data.data?.isp ?? "unknown"}.`,
      raw: data,
    };
  } catch (err) {
    return { source: "abuseipdb", verdict: "unknown", score: 0, summary: `AbuseIPDB lookup failed: ${(err as Error).message}`, raw: null };
  }
}

async function lookupVirusTotalIp(ip: string): Promise<EvidenceCard> {
  try {
    if (!VIRUSTOTAL_API_KEY) return { source: "virustotal", verdict: "unknown", score: 0, summary: "VirusTotal API key not configured.", raw: null };
    const res = await fetchWithTimeout(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
      headers: { "x-apikey": VIRUSTOTAL_API_KEY },
    });
    if (!res.ok) throw new Error(`VirusTotal HTTP ${res.status}`);
    const data = await res.json();
    const stats = data.data?.attributes?.last_analysis_stats ?? {};
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;
    const total = Object.values(stats).reduce((a: number, b) => a + (Number(b) || 0), 0) || 1;
    const score = Math.round(((malicious * 2 + suspicious) / (total * 2)) * 100);
    const verdict = malicious > 2 ? "malicious" : malicious > 0 || suspicious > 0 ? "suspicious" : "clean";
    return {
      source: "virustotal",
      verdict,
      score,
      summary: `${malicious} vendor(s) flagged malicious, ${suspicious} suspicious, out of ${total} engines.`,
      raw: data,
    };
  } catch (err) {
    return { source: "virustotal", verdict: "unknown", score: 0, summary: `VirusTotal lookup failed: ${(err as Error).message}`, raw: null };
  }
}

async function lookupVirusTotalHash(hash: string): Promise<EvidenceCard> {
  try {
    if (!VIRUSTOTAL_API_KEY) return { source: "virustotal", verdict: "unknown", score: 0, summary: "VirusTotal API key not configured.", raw: null };
    const res = await fetchWithTimeout(`https://www.virustotal.com/api/v3/files/${hash}`, {
      headers: { "x-apikey": VIRUSTOTAL_API_KEY },
    });
    if (res.status === 404) {
      return { source: "virustotal", verdict: "unknown", score: 0, summary: "File hash not found in VirusTotal database.", raw: null };
    }
    if (!res.ok) throw new Error(`VirusTotal HTTP ${res.status}`);
    const data = await res.json();
    const stats = data.data?.attributes?.last_analysis_stats ?? {};
    const malicious = stats.malicious ?? 0;
    const suspicious = stats.suspicious ?? 0;
    const total = Object.values(stats).reduce((a: number, b) => a + (Number(b) || 0), 0) || 1;
    const score = Math.round(((malicious * 2 + suspicious) / (total * 2)) * 100);
    const verdict = malicious > 5 ? "malicious" : malicious > 0 || suspicious > 0 ? "suspicious" : "clean";
    const names = data.data?.attributes?.names ?? [];
    return {
      source: "virustotal",
      verdict,
      score,
      summary: `File: ${names[0] ?? hash.slice(0, 12)}... ${malicious}/${total} engines flagged malicious.`,
      raw: data,
    };
  } catch (err) {
    return { source: "virustotal", verdict: "unknown", score: 0, summary: `VirusTotal file lookup failed: ${(err as Error).message}`, raw: null };
  }
}

async function lookupAlienVaultOtx(ip: string): Promise<EvidenceCard> {
  try {
    if (!ALIENVAULT_OTX_API_KEY) return { source: "alienvault_otx", verdict: "unknown", score: 0, summary: "AlienVault OTX API key not configured.", raw: null };
    const res = await fetchWithTimeout(`https://otx.alienvault.com/api/v1/indicators/IPv4/${ip}/general`, {
      headers: { "X-OTX-API-KEY": ALIENVAULT_OTX_API_KEY },
    });
    if (!res.ok) throw new Error(`AlienVault OTX HTTP ${res.status}`);
    const data = await res.json();
    const pulseCount = data.pulse_info?.count ?? 0;
    const score = Math.min(100, pulseCount * 10);
    const verdict = pulseCount >= 5 ? "malicious" : pulseCount > 0 ? "suspicious" : "clean";
    return {
      source: "alienvault_otx",
      verdict,
      score,
      summary: `${pulseCount} threat intel pulse(s) reference this IP. Reputation: ${data.reputation ?? 0}.`,
      raw: data,
    };
  } catch (err) {
    return { source: "alienvault_otx", verdict: "unknown", score: 0, summary: `AlienVault OTX lookup failed: ${(err as Error).message}`, raw: null };
  }
}

async function lookupHash(hash: string | null): Promise<EvidenceCard[]> {
  if (!hash) return [];
  const vt = await lookupVirusTotalHash(hash);
  return [vt];
}

// ---------- LLM agent calls ----------
//
// Primary: Enter AI gateway (Gemini). Fallback: Groq (OpenAI-compatible chat
// completions, free tier) -- used automatically whenever the primary call
// fails for any reason (credits exhausted, timeout, non-2xx). This keeps the
// multi-agent pipeline demoable even when one provider is unavailable, and
// every action log records which provider actually answered.

interface AgentCallResult {
  json: Record<string, unknown>;
  provider: "enter" | "gemini" | "groq" | "fallback";
}

async function callEnterGemini(systemInstruction: string, userPrompt: string): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(`${AI_BASE}/${AI_MODEL}:streamGenerateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": AI_API_TOKEN,
      "Content-Type": "application/json",
      "X-Session-ID": crypto.randomUUID(),
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) {
    throw new Error(`AI gateway error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const text = await response.text();
  let fullText = "";
  for (const line of text.split(String.fromCharCode(10))) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payload);
      for (const part of chunk?.candidates?.[0]?.content?.parts ?? []) {
        if (typeof part.text === "string") fullText += part.text;
      }
    } catch { /* ignore keep-alive noise */ }
  }
  if (!fullText.trim()) throw new Error("AI gateway returned an empty response");
  try {
    return JSON.parse(fullText);
  } catch {
    throw new Error(`Agent returned non-JSON output: ${fullText.slice(0, 300)}`);
  }
}

async function callGroq(systemInstruction: string, userPrompt: string): Promise<Record<string, unknown>> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty response");
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Groq agent returned non-JSON output: ${String(content).slice(0, 300)}`);
  }
}

async function callGeminiDirect(systemInstruction: string, userPrompt: string): Promise<Record<string, unknown>> {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_AI_API_KEY") ?? "";
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini direct error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text?.trim()) throw new Error("Gemini direct returned empty response");

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Gemini direct returned non-JSON: ${text.slice(0, 300)}`);
  }
}

async function callAgent(systemInstruction: string, userPrompt: string): Promise<AgentCallResult> {
  // Try 1: Gemini direct (most reliable - your own API key)
  try {
    const json = await callGeminiDirect(systemInstruction, userPrompt);
    return { json, provider: "gemini" };
  } catch (geminiError) {
    console.warn("Gemini direct failed:", (geminiError as Error).message?.slice(0, 200));
  }

  // Try 2: Enter AI gateway (Gemini via proxy)
  try {
    const json = await callEnterGemini(systemInstruction, userPrompt);
    return { json, provider: "enter" };
  } catch (enterError) {
    console.warn("Enter AI gateway failed:", (enterError as Error).message?.slice(0, 200));
  }

  // Try 3: Groq fallback (only if key is configured)
  if (GROQ_API_KEY) {
    try {
      const json = await callGroq(systemInstruction, userPrompt);
      return { json, provider: "groq" };
    } catch (groqError) {
      console.warn("Groq fallback failed:", (groqError as Error).message?.slice(0, 200));
    }
  } else {
    console.warn("Groq API key not configured, skipping Groq fallback");
  }

  // Try 4: Safe defaults based on context
  console.warn("All AI providers failed, using safe defaults");
  const lowerSystem = systemInstruction.toLowerCase();
  let fallbackJson: Record<string, unknown>;
  if (lowerSystem.includes("threat detection") || lowerSystem.includes("initial assessment")) {
    fallbackJson = { initialSeverity: "medium", reasoning: "All AI providers unavailable. Defaulting to medium severity for manual review." };
  } else if (lowerSystem.includes("malware")) {
    fallbackJson = { verdict: "suspicious", confidence: 50, reasoning: "All AI providers unavailable. Flagging as suspicious for manual review." };
  } else if (lowerSystem.includes("incident response") || lowerSystem.includes("decide")) {
    fallbackJson = { decision: "escalate", riskScore: 60, reasoning: "All AI providers unavailable. Escalating for human review." };
  } else {
    fallbackJson = { reasoning: "All AI providers unavailable. Manual review required.", riskScore: 50 };
  }
  return { json: fallbackJson, provider: "fallback" };
}

// ---------- Notion helpers ----------

async function notionFetch(token: string, path: string, init?: RequestInit) {
  if (!token) {
    console.warn("Notion token not configured, skipping Notion call");
    return null;
  }
  try {
    const response = await fetchWithTimeout(`https://api.notion.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      console.warn(`Notion API error (${response.status}): skipping Notion sync`);
      return null;
    }
    return response.json();
  } catch (err) {
    console.warn("Notion API call failed, continuing without Notion sync:", err);
    return null;
  }
}

async function createNotionIncidentPage(incident: {
  incident_number: string; title: string; category: string; severity: string;
  risk_score: number; source_ip: string; file_hash: string | null; evidenceSummary: string;
}) {
  if (!DETECTION_NOTION_TOKEN || !NOTION_INCIDENTS_DB_ID) return null;
  return await notionFetch(DETECTION_NOTION_TOKEN, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_INCIDENTS_DB_ID },
      properties: {
        Title: { title: [{ text: { content: `${incident.incident_number}: ${incident.title}` } }] },
        Category: { select: { name: incident.category } },
        Severity: { select: { name: incident.severity } },
        "Risk Score": { number: incident.risk_score },
        "Source IP": { rich_text: [{ text: { content: incident.source_ip } }] },
        "File Hash": { rich_text: [{ text: { content: incident.file_hash ?? "" } }] },
        Status: { select: { name: "Analyzing" } },
        "Evidence Summary": { rich_text: [{ text: { content: incident.evidenceSummary.slice(0, 2000) } }] },
        "Incident #": { rich_text: [{ text: { content: incident.incident_number } }] },
      },
    }),
  });
}

async function createNotionApprovalRequest(incident: {
  incident_number: string; title: string; severity: string; risk_score: number;
  source_ip: string; recommendation: string; reasoning: string;
}) {
  if (!RESPONSE_NOTION_TOKEN || !NOTION_APPROVALS_DB_ID) return null;
  return await notionFetch(RESPONSE_NOTION_TOKEN, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_APPROVALS_DB_ID },
      properties: {
        Title: { title: [{ text: { content: `Approve block: ${incident.incident_number} (${incident.source_ip})` } }] },
        Severity: { select: { name: incident.severity } },
        "Risk Score": { number: incident.risk_score },
        "Source IP": { rich_text: [{ text: { content: incident.source_ip } }] },
        Recommendation: { rich_text: [{ text: { content: incident.recommendation } }] },
        Status: { select: { name: "Pending" } },
        "Incident #": { rich_text: [{ text: { content: incident.incident_number } }] },
        Reasoning: { rich_text: [{ text: { content: incident.reasoning.slice(0, 2000) } }] },
      },
    }),
  });
}

async function logToNotionAuditDb(entry: { agent: string; action: string; incidentNumber: string; summary: string }) {
  if (!COMPLIANCE_NOTION_TOKEN || !NOTION_AUDIT_LOG_DB_ID) return;
  try {
    await notionFetch(COMPLIANCE_NOTION_TOKEN, "/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { database_id: NOTION_AUDIT_LOG_DB_ID },
        properties: {
          Title: { title: [{ text: { content: `${entry.incidentNumber} — ${entry.action}` } }] },
          Agent: { select: { name: entry.agent } },
          Action: { rich_text: [{ text: { content: entry.action } }] },
          "Incident #": { rich_text: [{ text: { content: entry.incidentNumber } }] },
          Summary: { rich_text: [{ text: { content: entry.summary.slice(0, 2000) } }] },
        },
      }),
    });
  } catch (err) {
    console.error("logToNotionAuditDb failed:", err);
  }
}

// ---------- DB helpers ----------

async function logAction(incidentId: string, actor: string, actionType: string, reasoning: string, payload: Record<string, unknown> = {}, searchExtras: string[] = []) {
  const searchText = [actor, actionType, reasoning, ...searchExtras].filter(Boolean).join(" ");
  const { error } = await supabase.from("incident_actions").insert({
    incident_id: incidentId,
    actor,
    action_type: actionType,
    reasoning,
    payload,
    search_text: searchText,
  });
  if (error) console.error("logAction insert error:", error);
}

async function setAgentStatus(agentName: string, state: "idle" | "working" | "blocked", incidentId: string | null) {
  await supabase.from("agent_status").update({
    state,
    last_active_at: new Date().toISOString(),
    current_incident_id: incidentId,
  }).eq("agent_name", agentName);
}

function scoreToSeverity(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 25) return "medium";
  return "low";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let incidentId: string | undefined;

  try {
    const body = await req.json();
    incidentId = body.incidentId;
    if (!incidentId) throw new Error("incidentId is required");

    const { data: existing } = await supabase
      .from("security_incidents")
      .select("*")
      .eq("id", incidentId)
      .single();
    if (!existing) throw new Error("Incident not found");
    if (existing.status !== "detected") {
      return new Response(JSON.stringify({ success: true, skipped: true, status: existing.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: alreadyStarted } = await supabase
      .from("incident_actions")
      .select("id", { count: "exact", head: true })
      .eq("incident_id", incidentId)
      .eq("action_type", "detect");
    if (alreadyStarted && alreadyStarted > 0) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "already started" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incident = existing;
    const searchExtras = [incident.incident_number, incident.source_ip, incident.file_hash ?? ""];

    // --- Threat Detection Agent ---
    await setAgentStatus("threat_detection", "working", incidentId);
    const detectionSystem = [
      "You are the Threat Detection Agent of an AI-native cybersecurity operations center.",
      "Review the raw security event and produce an initial assessment before OSINT enrichment.",
      `Respond ONLY with strict JSON: {"initialSeverity": "low"|"medium"|"high"|"critical", "reasoning": string (1-3 sentences, plain SOC-analyst language)}.`,
    ].join(String.fromCharCode(10));
    const detectionUser = [
      `Incident: ${incident.title}`,
      `Category: ${incident.category}`,
      `Source IP: ${incident.source_ip}`,
      incident.file_hash ? `File hash observed: ${incident.file_hash}` : "No file hash observed.",
    ].join(String.fromCharCode(10));
    const detectionResult = await callAgent(detectionSystem, detectionUser);
    const detection = detectionResult.json;

    await logAction(incidentId, "threat_detection", "detect", detection.reasoning as string, { initialSeverity: detection.initialSeverity, llmProvider: detectionResult.provider }, searchExtras);
    await logToNotionAuditDb({ agent: "Threat Detection", action: "Detected event", incidentNumber: incident.incident_number, summary: detection.reasoning as string });
    await supabase.from("security_incidents").update({ status: "analyzing" }).eq("id", incidentId);

    // --- OSINT enrichment (parallel, real API calls, normalized) ---
    const [shodanCard, abuseCard, vtIpCard, otxCard] = await Promise.all([
      lookupShodan(incident.source_ip),
      lookupAbuseIPDB(incident.source_ip),
      lookupVirusTotalIp(incident.source_ip),
      lookupAlienVaultOtx(incident.source_ip),
    ]);
    const hashCards = await lookupHash(incident.file_hash);
    const allCards = [shodanCard, abuseCard, vtIpCard, otxCard, ...hashCards];

    for (const card of allCards) {
      await supabase.from("incident_evidence").insert({
        incident_id: incidentId,
        source: card.source,
        verdict: card.verdict,
        score: card.score,
        summary: card.summary,
        raw_response: card.raw,
      });
    }
    const evidenceSummaryText = allCards.map((c) => `[${c.source}] ${c.verdict} (${c.score}): ${c.summary}`).join(" | ");
    await logAction(incidentId, "threat_detection", "enrich", `OSINT enrichment complete across ${allCards.length} sources.`, { cards: allCards.map((c) => ({ source: c.source, verdict: c.verdict, score: c.score })) }, searchExtras);
    await setAgentStatus("threat_detection", "idle", null);

    // --- Malware Analysis Agent (only if a file hash was observed) ---
    let malwareVerdict: { verdict: string; confidence: number; reasoning: string } | null = null;
    if (incident.file_hash && hashCards.length > 0) {
      await setAgentStatus("malware_analysis", "working", incidentId);
      const malwareSystem = [
        "You are the Malware Analysis Agent of an AI-native cybersecurity operations center.",
        "Review the VirusTotal file evidence and produce a malware verdict.",
        `Respond ONLY with strict JSON: {"verdict": "benign"|"suspicious"|"malicious", "confidence": number (0-100), "reasoning": string (1-3 sentences)}.`,
      ].join(String.fromCharCode(10));
      const malwareUser = `File hash: ${incident.file_hash}\nVirusTotal evidence: ${hashCards[0].summary}`;
      const malwareResult = await callAgent(malwareSystem, malwareUser);
      malwareVerdict = malwareResult.json as unknown as typeof malwareVerdict;
      await logAction(incidentId, "malware_analysis", "analyze", malwareVerdict!.reasoning, { ...malwareVerdict, llmProvider: malwareResult.provider } as unknown as Record<string, unknown>, searchExtras);
      await logToNotionAuditDb({ agent: "Malware Analysis", action: "Analyzed file hash", incidentNumber: incident.incident_number, summary: malwareVerdict!.reasoning });
      await setAgentStatus("malware_analysis", "idle", null);
    }

    // --- Incident Response Agent: combine everything, decide ---
    await setAgentStatus("incident_response", "working", incidentId);
    const avgOsintScore = allCards.reduce((sum, c) => sum + c.score, 0) / Math.max(allCards.length, 1);
    const responseSystem = [
      "You are the Incident Response Agent of an AI-native cybersecurity operations center.",
      "Combine the Threat Detection assessment, OSINT evidence, and (if present) Malware Analysis verdict to decide the response.",
      "If the situation is high-confidence and low-risk-of-false-positive, you may auto-resolve with 'monitor' or 'block'.",
      "If the risk is high/critical and blocking would have real business impact, you must 'escalate' for human approval before any block action executes.",
      `Respond ONLY with strict JSON: {"decision": "monitor"|"block"|"escalate", "riskScore": number (0-100), "reasoning": string (1-3 sentences, plain SOC-analyst language, no markdown)}.`,
    ].join(String.fromCharCode(10));
    const responseUser = [
      `Incident: ${incident.title} (${incident.category})`,
      `Detection assessment: ${detection.reasoning} (initial severity: ${detection.initialSeverity})`,
      `Average OSINT risk score: ${avgOsintScore.toFixed(0)}/100`,
      `OSINT evidence: ${evidenceSummaryText}`,
      malwareVerdict ? `Malware verdict: ${malwareVerdict.verdict} (${malwareVerdict.confidence}% confidence): ${malwareVerdict.reasoning}` : "No file hash to analyze.",
    ].join(String.fromCharCode(10));
    const responseResult = await callAgent(responseSystem, responseUser);
    const responseDecision = responseResult.json;
    const riskScore = Math.round(responseDecision.riskScore as number);
    const severity = scoreToSeverity(riskScore);

    await logAction(incidentId, "incident_response", "decide", responseDecision.reasoning as string, { decision: responseDecision.decision, riskScore, llmProvider: responseResult.provider }, searchExtras);

    await supabase.from("security_incidents").update({
      risk_score: riskScore,
      severity,
    }).eq("id", incidentId);

    if (responseDecision.decision === "escalate") {
      // --- Human-in-the-loop gate: create Notion approval request, stop here ---
      const notionIncidentPage = await createNotionIncidentPage({
        incident_number: incident.incident_number,
        title: incident.title,
        category: incident.category,
        severity,
        risk_score: riskScore,
        source_ip: incident.source_ip,
        file_hash: incident.file_hash,
        evidenceSummary: evidenceSummaryText,
      });
      const approvalPage = await createNotionApprovalRequest({
        incident_number: incident.incident_number,
        title: incident.title,
        severity,
        risk_score: riskScore,
        source_ip: incident.source_ip,
        recommendation: "block",
        reasoning: responseDecision.reasoning as string,
      });

      await logAction(incidentId, "incident_response", "escalate", `Escalated for human approval: ${responseDecision.reasoning}`, {}, searchExtras);
      await logToNotionAuditDb({ agent: "Incident Response", action: "Escalated for approval", incidentNumber: incident.incident_number, summary: responseDecision.reasoning as string });

      await supabase.from("security_incidents").update({
        status: "pending_approval",
        decision: "block",
        notion_page_id: notionIncidentPage?.id ?? approvalPage?.id ?? null,
        notion_url: approvalPage?.url ?? notionIncidentPage?.url ?? null,
      }).eq("id", incidentId);

      await logAction(incidentId, "compliance", "notion_synced", "Approval request recorded in Notion; awaiting human decision.", { notion_url: approvalPage?.url }, searchExtras);
    } else {
      // --- Auto-resolved (monitor or low-risk block) ---
      const notionIncidentPage = await createNotionIncidentPage({
        incident_number: incident.incident_number,
        title: incident.title,
        category: incident.category,
        severity,
        risk_score: riskScore,
        source_ip: incident.source_ip,
        file_hash: incident.file_hash,
        evidenceSummary: evidenceSummaryText,
      });

      await logAction(incidentId, "incident_response", "block_executed", `Auto-resolved (${responseDecision.decision}): ${responseDecision.reasoning}`, { decision: responseDecision.decision }, searchExtras);
      await logToNotionAuditDb({ agent: "Incident Response", action: `Auto-resolved: ${responseDecision.decision}`, incidentNumber: incident.incident_number, summary: responseDecision.reasoning as string });

      await supabase.from("security_incidents").update({
        status: "resolved",
        decision: responseDecision.decision,
        notion_page_id: notionIncidentPage?.id ?? null,
        notion_url: notionIncidentPage?.url ?? null,
      }).eq("id", incidentId);
    }

    await setAgentStatus("incident_response", "idle", null);

    return new Response(JSON.stringify({ success: true, riskScore, decision: responseDecision.decision }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("run-incident-pipeline error:", error);
    if (incidentId) {
      await logAction(incidentId, "compliance", "error", `Pipeline failed: ${error.message}`, {});
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
