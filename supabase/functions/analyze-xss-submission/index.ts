// Honeypot XSS analysis. Accepts a user-submitted "comment" or "login" style
// payload from the Fake Admin Panel decoy, runs a fast regex bank for common
// XSS vectors, then asks the Threat Detection Agent (Enter Gemini -> Groq
// fallback) to explain the risk in plain language.
//
// SAFETY: this function NEVER executes the submitted payload. It returns the
// payload as plain escaped text plus a verdict/explanation; the frontend
// renders it only inside a clearly labeled sandboxed preview using text
// content (never innerHTML/eval). This demonstrates the XSS risk without
// introducing a real vulnerability into the app.

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
const FETCH_TIMEOUT_MS = 15000;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Fast structural check for common XSS vectors -- runs before any LLM call.
const XSS_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /<script[\s>]/i, label: "<script> tag" },
  { pattern: /on(error|load|click|mouseover|focus)\s*=/i, label: "inline event handler" },
  { pattern: /javascript:/i, label: "javascript: URI" },
  { pattern: /<svg[\s>]/i, label: "<svg> vector" },
  { pattern: /<img[^>]+onerror/i, label: "<img onerror> vector" },
  { pattern: /<iframe[\s>]/i, label: "<iframe> injection" },
  { pattern: /document\.(cookie|location)/i, label: "cookie/location access" },
  { pattern: /eval\s*\(/i, label: "eval() call" },
  { pattern: /<\s*\/?\s*(body|link|meta)[\s>]/i, label: "HTML structural injection" },
];

function detectXssPatterns(payload: string): string[] {
  return XSS_PATTERNS.filter((p) => p.pattern.test(payload)).map((p) => p.label);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error(`Request to ${url} timed out`);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callEnterGemini(systemInstruction: string, userPrompt: string): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout(`${AI_BASE}/${AI_MODEL}:streamGenerateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": AI_API_TOKEN, "Content-Type": "application/json", "X-Session-ID": crypto.randomUUID() },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) throw new Error(`AI gateway error (${response.status}): ${(await response.text()).slice(0, 400)}`);
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
    } catch { /* ignore */ }
  }
  if (!fullText.trim()) throw new Error("AI gateway returned an empty response");
  return JSON.parse(fullText);
}

async function callGroq(systemInstruction: string, userPrompt: string): Promise<Record<string, unknown>> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: systemInstruction }, { role: "user", content: userPrompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`Groq error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned an empty response");
  return JSON.parse(content);
}

async function callAgent(systemInstruction: string, userPrompt: string): Promise<{ json: Record<string, unknown>; provider: "enter" | "groq" }> {
  try {
    return { json: await callEnterGemini(systemInstruction, userPrompt), provider: "enter" };
  } catch (err) {
    console.error("Primary AI gateway failed, falling back to Groq:", err);
    return { json: await callGroq(systemInstruction, userPrompt), provider: "groq" };
  }
}

function pad(n: number, width: number) {
  return n.toString().padStart(width, "0");
}

// Realistic-looking source IPs for the honeypot demo (documented test/threat-intel ranges).
const DEMO_ATTACKER_IPS = ["185.220.101.1", "45.155.205.233", "193.32.162.157", "91.212.166.15", "80.94.95.116"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { payload, field } = await req.json();
    if (typeof payload !== "string" || !payload.trim()) throw new Error("payload is required");

    const sourceIp = DEMO_ATTACKER_IPS[Math.floor(Math.random() * DEMO_ATTACKER_IPS.length)];
    const detectedPatterns = detectXssPatterns(payload);
    const structuralVerdict: "clean" | "suspicious" | "malicious" =
      detectedPatterns.length >= 2 ? "malicious" : detectedPatterns.length === 1 ? "suspicious" : "clean";

    let agentExplanation = "";
    let llmProvider: "enter" | "groq" = "enter";
    try {
      const system = [
        "You are the Threat Detection Agent of an AI-native cybersecurity honeypot.",
        "A payload was submitted to a decoy admin panel login/comment field. Explain in plain, non-technical SOC language what this payload would do if it executed unescaped in a real browser, or confirm it looks benign.",
        `Respond ONLY with strict JSON: {"explanation": string (1-3 sentences)}.`,
      ].join(String.fromCharCode(10));
      const user = `Field: ${field ?? "comment"}\nSubmitted payload: ${payload}\nStructural patterns detected: ${detectedPatterns.join(", ") || "none"}`;
      const result = await callAgent(system, user);
      agentExplanation = (result.json.explanation as string) ?? "";
      llmProvider = result.provider;
    } catch (err) {
      agentExplanation = `Automated explanation unavailable (${(err as Error).message}). Structural analysis: ${detectedPatterns.length > 0 ? `matched ${detectedPatterns.join(", ")}` : "no known XSS patterns matched"}.`;
    }

    let incidentId: string | null = null;
    let incidentNumber: string | null = null;

    if (structuralVerdict !== "clean") {
      const { count } = await supabase.from("security_incidents").select("id", { count: "exact", head: true });
      incidentNumber = `INC-${pad((count ?? 0) + 1, 4)}`;
      const { data: incident, error: insertError } = await supabase
        .from("security_incidents")
        .insert({
          incident_number: incidentNumber,
          title: "XSS payload submitted to honeypot admin panel",
          category: "xss",
          source_ip: sourceIp,
          status: "detected",
        })
        .select()
        .single();
      if (!insertError && incident) {
        incidentId = incident.id;
        fetch(`${SUPABASE_URL}/functions/v1/run-incident-pipeline`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ incidentId: incident.id }),
        }).catch((err) => console.error("Failed to trigger pipeline:", err));
      }
    }

    await supabase.from("honeypot_events").insert({
      service: "admin_panel",
      event_type: "xss_submission",
      payload,
      source_ip: sourceIp,
      detected_pattern: detectedPatterns.join(", ") || null,
      verdict: structuralVerdict,
      incident_id: incidentId,
    });

    return new Response(JSON.stringify({
      verdict: structuralVerdict,
      detectedPatterns,
      explanation: agentExplanation,
      llmProvider,
      sourceIp,
      incidentId,
      incidentNumber,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-xss-submission error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
