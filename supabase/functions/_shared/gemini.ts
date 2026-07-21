const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_AI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const FETCH_TIMEOUT_MS = 25000;

export type GeminiJsonResult = {
  recommendation: "approve" | "reject" | "negotiate";
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  strengths: string[];
  [key: string]: unknown;
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
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

async function callGeminiDirect<T extends Record<string, unknown>>(
  systemInstruction: string,
  userPrompt: string,
): Promise<T> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
    throw new Error(`Gemini API error (${response.status}): ${(await response.text()).slice(0, 400)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text?.trim()) throw new Error("Gemini returned an empty response");

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 300)}`);
  }
}

async function callGroqFallback<T extends Record<string, unknown>>(
  systemInstruction: string,
  userPrompt: string,
): Promise<T> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

  const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
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
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Groq returned non-JSON output: ${String(content).slice(0, 300)}`);
  }
}

export async function callGeminiJson<T extends Record<string, unknown>>(
  systemInstruction: string,
  userPrompt: string,
): Promise<T> {
  // Try Gemini first
  try {
    return await callGeminiDirect<T>(systemInstruction, userPrompt);
  } catch (geminiError) {
    console.warn("Gemini failed, trying Groq fallback:", (geminiError as Error).message?.slice(0, 200));
  }

  // Fallback to Groq
  try {
    return await callGroqFallback<T>(systemInstruction, userPrompt);
  } catch (groqError) {
    console.warn("Groq fallback also failed:", (groqError as Error).message?.slice(0, 200));
  }

  // Final fallback: return safe defaults
  console.warn("All AI providers failed, returning safe defaults");
  return {
    recommendation: "negotiate",
    confidence: 30,
    reasoning: "AI analysis unavailable. Manual review recommended.",
    riskFactors: ["AI provider unavailable"],
    strengths: [],
  } as unknown as T;
}
