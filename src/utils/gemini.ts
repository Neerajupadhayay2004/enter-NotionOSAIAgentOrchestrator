export interface IncidentAnalysis {
  decision: "approve" | "block";
  confidence: number;
  reasoning: string;
  severity: "low" | "medium" | "high" | "critical";
  riskScore: number;
}

export async function analyzeIncidentWithGemini(
  incident: {
    title: string;
    category: string;
    sourceIp: string;
    description?: string;
    fileHash?: string;
  },
  apiKey?: string
): Promise<IncidentAnalysis> {
  const GEMINI_API_KEY = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    console.warn("Gemini API key not found, using fallback analysis");
    return getFallbackAnalysis(incident);
  }

  try {
    const prompt = `You are a cybersecurity expert. Analyze this security incident and provide a decision.

Incident Details:
- Title: ${incident.title}
- Category: ${incident.category}
- Source IP: ${incident.sourceIp}
${incident.fileHash ? `- File Hash: ${incident.fileHash}` : ""}
${incident.description ? `- Description: ${incident.description}` : ""}

Please analyze and respond with ONLY a JSON object in this format:
{
  "decision": "approve" or "block",
  "confidence": number between 0 and 1,
  "reasoning": "brief explanation of your decision",
  "severity": "low" or "medium" or "high" or "critical",
  "riskScore": number between 0 and 100
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API request failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        decision: analysis.decision === "block" ? "block" : "approve",
        confidence: Math.min(1, Math.max(0, analysis.confidence || 0.8)),
        reasoning: analysis.reasoning || "Analysis complete",
        severity: ["low", "medium", "high", "critical"].includes(analysis.severity) 
          ? analysis.severity 
          : "medium",
        riskScore: Math.min(100, Math.max(0, analysis.riskScore || 50)),
      };
    }
    
    throw new Error("Failed to parse Gemini response");
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return getFallbackAnalysis(incident);
  }
}

function getFallbackAnalysis(incident: {
  title: string;
  category: string;
  sourceIp: string;
}): IncidentAnalysis {
  const highRiskCategories = ["malware", "ddos", "c2_beacon", "sql_injection"];
  const mediumRiskCategories = ["brute_force", "phishing", "xss"];
  
  let severity: "low" | "medium" | "high" | "critical" = "low";
  let decision: "approve" | "block" = "approve";
  let riskScore = 30;
  
  if (highRiskCategories.includes(incident.category)) {
    severity = "critical";
    decision = "block";
    riskScore = 90;
  } else if (mediumRiskCategories.includes(incident.category)) {
    severity = "high";
    decision = "block";
    riskScore = 70;
  } else if (incident.category === "port_scan") {
    severity = "medium";
    decision = "approve";
    riskScore = 40;
  }
  
  return {
    decision,
    confidence: 0.85,
    reasoning: `Automated analysis: ${incident.category} incident from ${incident.sourceIp}`,
    severity,
    riskScore,
  };
}
