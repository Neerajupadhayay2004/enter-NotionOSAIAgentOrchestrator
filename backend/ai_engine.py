import os
import json
import logging
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def _get_gemini_key() -> str:
    return os.getenv("GEMINI_API_KEY", "")


def _get_groq_key() -> str:
    return os.getenv("GROQ_API_KEY", "")


def _get_openrouter_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "")


async def call_gemini(system_instruction: str, user_prompt: str) -> dict:
    """Call Gemini API for JSON-structured analysis."""
    api_key = _get_gemini_key()
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system_instruction,
    )

    response = model.generate_content(
        user_prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            response_mime_type="application/json",
        ),
    )

    text = response.text
    if not text or not text.strip():
        raise ValueError("Gemini returned empty response")

    return json.loads(text)


async def call_groq(system_instruction: str, user_prompt: str) -> dict:
    """Call Groq API as fallback."""
    api_key = _get_groq_key()
    if not api_key:
        raise ValueError("GROQ_API_KEY not configured")

    import groq
    client = groq.Groq(api_key=api_key)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    if not content:
        raise ValueError("Groq returned empty response")

    return json.loads(content)


async def call_openrouter(system_instruction: str, user_prompt: str) -> dict:
    """Call OpenRouter API as last fallback."""
    api_key = _get_openrouter_key()
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not configured")

    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-4o",
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.3,
            },
        )

        if response.status_code != 200:
            raise ValueError(f"OpenRouter error: {response.status_code}")

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)


async def call_ai(system_instruction: str, user_prompt: str) -> tuple[dict, str]:
    """Try Gemini -> Groq -> OpenRouter fallback chain. Returns (result, provider)."""
    providers = [
        ("gemini", call_gemini),
        ("groq", call_groq),
        ("openrouter", call_openrouter),
    ]

    last_error = None
    for provider_name, provider_fn in providers:
        try:
            result = await provider_fn(system_instruction, user_prompt)
            logger.info(f"AI call succeeded with {provider_name}")
            return result, provider_name
        except Exception as e:
            logger.warning(f"AI call failed with {provider_name}: {e}")
            last_error = e

    raise ValueError(f"All AI providers failed. Last error: {last_error}")


async def analyze_budget(
    campaign_name: str,
    category: str,
    requested_amount: float,
    final_amount: Optional[float],
    status: str,
    justification: str,
    requested_by: str,
    negotiation_log: str = "",
) -> dict:
    """Analyze a budget request and recommend approve/reject/negotiate with market analysis."""

    system_instruction = """You are the Board Advisor AI for an AI-native Enterprise Operating System. You are the Finance agent performing deep market analysis.

## Your Role
You are the analytical backbone of the enterprise. You evaluate every budget request using:
1. Current market benchmarks and real-world pricing data
2. ROI projections with specific numbers and timeframes
3. Competitive positioning analysis
4. Risk-adjusted return on investment
5. Budget optimization opportunities

## Category Market Benchmarks:
- **Paid Ads**: $2K-$15K/month. ROAS: 3-5x. CPM: $5-$15. CPC: $0.50-$3.00. Break-even: 2-3 months.
- **Events**: $5K-$50K. Cost per lead: $50-$200. Brand lift: 10-25%. Pipeline ROI: 3-6 months.
- **Content & Creative**: $1K-$10K. SEO compounding value over 6-12 months. Organic traffic value: $2-$10/visitor.
- **Tools & Software**: $500-$5K/month. Expected productivity ROI: 2-3x within first quarter.
- **Sponsorships**: $3K-$25K. CPM: $10-$30. Brand lift: 5-15%. Audience alignment is critical.
- **Research & Development**: $5K-$30K. IP creation. Time-to-value: 3-6 months.
- **Training & Education**: $1K-$10K. ROI through productivity and retention gains.
- **Travel & Entertainment**: $1K-$8K. Deal closure probability +15-25%.

## Decision Framework:
- **APPROVE**: Within benchmarks, clear ROI, justified justification. Well-justified requests under $10K should be APPROVED.
- **REJECT**: Excessive (>2x market average without justification), unclear ROI, or policy violation.
- **NEGOTIATE**: Promising but needs amount reduction or stronger justification. Always provide a specific recommended amount.

## Required Output (strict JSON):
{
  "recommendation": "approve"|"reject"|"negotiate",
  "confidence": number (0-100),
  "reasoning": "3-5 sentences with specific market data, ROI projections, and competitive context",
  "riskFactors": ["specific risk 1", "specific risk 2"],
  "strengths": ["specific strength 1", "specific strength 2"],
  "marketAnalysis": "2-3 sentences on market fit, typical spend range, and competitive positioning",
  "recommendedAmount": number|null (provide if negotiating, null otherwise)
}

Be decisive, data-driven, and specific. Reference actual benchmark numbers in your analysis."""

    final_amt_str = f"${final_amount:,.0f}" if final_amount else "pending"
    negotiation_section = f"\n\nNegotiation timeline:\n{negotiation_log}" if negotiation_log else "\n\nNo negotiation actions yet."

    user_prompt = f"""Analyze this budget request against market conditions:

Campaign: {campaign_name}
Category: {category}
Requested amount: ${requested_amount:,.0f}
Negotiated final amount: {final_amt_str}
Status: {status}
Justification: {justification}
Requested by: {requested_by}
{negotiation_section}

Provide a thorough market analysis and clear recommendation."""

    result, provider = await call_ai(system_instruction, user_prompt)

    return {
        "recommendation": result.get("recommendation", "negotiate"),
        "confidence": min(max(result.get("confidence", 50), 0), 100),
        "reasoning": result.get("reasoning", f"AI recommends {result.get('recommendation', 'negotiate')} based on market analysis."),
        "risk_factors": result.get("riskFactors", []),
        "strengths": result.get("strengths", []),
        "market_analysis": result.get("marketAnalysis", ""),
        "recommended_amount": result.get("recommendedAmount", None),
        "provider": provider,
    }


async def analyze_security_incident(
    incident_number: str,
    title: str,
    category: str,
    source_ip: str,
    file_hash: Optional[str],
    evidence_summary: str,
    osint_scores: dict,
) -> dict:
    """Analyze a security incident and recommend response action."""

    system_instruction = """You are the Incident Response AI for a cybersecurity operations center.

Combine the threat detection assessment, OSINT evidence, and malware analysis to decide the response.

IMPORTANT: You must respond with ONE decision:
- "monitor" — low risk, observe but take no action
- "block" — high confidence threat, block the IP/hash
- "escalate" — high/critical risk but blocking has business impact, needs human approval

Respond ONLY with strict JSON:
{"decision":"monitor"|"block"|"escalate","riskScore":number(0-100),"severity":"low"|"medium"|"high"|"critical","reasoning":string(2-4 sentences)}

Be decisive but cautious. Escalate when uncertain or when blocking could impact legitimate traffic."""

    avg_score = sum(osint_scores.values()) / max(len(osint_scores), 1) if osint_scores else 0

    user_prompt = f"""Incident: {incident_number} — {title}
Category: {category}
Source IP: {source_ip}
File hash: {file_hash or "None observed"}
Average OSINT risk score: {avg_score:.0f}/100
OSINT evidence: {evidence_summary or "No evidence collected yet."}

Decide the appropriate response action."""

    result, provider = await call_ai(system_instruction, user_prompt)

    severity = result.get("severity", "medium")
    risk_score = min(max(result.get("riskScore", 50), 0), 100)

    if risk_score >= 80:
        severity = "critical"
    elif risk_score >= 55:
        severity = "high"
    elif risk_score >= 25:
        severity = "medium"
    else:
        severity = "low"

    return {
        "decision": result.get("decision", "monitor"),
        "risk_score": risk_score,
        "severity": severity,
        "reasoning": result.get("reasoning", "AI analysis complete."),
        "provider": provider,
    }
