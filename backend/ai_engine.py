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

    system_instruction = """You are the Board Advisor AI for an enterprise Budget Operating System. You perform deep market analysis to make informed budget decisions.

## Your Role
Analyze budget requests holistically by combining:
1. Market benchmarks for the specific category
2. ROI potential and expected returns
3. Justification quality and completeness
4. Negotiation outcome (if any)
5. Financial prudence and policy compliance

## Category Market Benchmarks (use these for analysis):
- **Paid Ads**: $2K-$15K/month typical. Expected ROAS: 3-5x. CPM: $5-$15. CPC: $0.50-$3.00.
- **Events**: $5K-$50K typical. Brand awareness + lead gen ROI. Cost per lead: $50-$200.
- **Content & Creative**: $1K-$10K typical. Long-term SEO/brand value. Content ROI compounds over 6-12 months.
- **Tools & Software**: $500-$5K/month typical. Productivity ROI should be 2-3x the cost within first quarter.
- **Sponsorships**: $3K-$25K typical. Audience reach metrics. CPM: $10-$30. Brand lift: 5-15%.
- **Research & Development**: $5K-$30K typical. IP creation potential. Time-to-value: 3-6 months.
- **Training & Education**: $1K-$10K typical. Team capability improvement. ROI through productivity gains.
- **Travel & Entertainment**: $1K-$8K typical. Client relationship value. Deal closure probability increase.

## Decision Rules:
- **APPROVE**: Request is within market benchmarks, has clear ROI justification, and the amount is reasonable for the campaign type. Most well-justified requests under $10,000 with clear ROI should be APPROVED.
- **REJECT**: Spend is unjustified, excessive (>2x market average without justification), or policy-violating. Requests with no clear ROI path or unrealistic projections.
- **NEGOTIATE**: Amount could work but needs reduction to align with market benchmarks, or justification needs strengthening. Counter with a specific market-aligned amount.

## Market Analysis Framework:
For each request, evaluate:
1. **Market Fit**: Is this amount typical for the category? How does it compare to industry benchmarks?
2. **ROI Projection**: What return can we expect? Is it measurable?
3. **Competitive Position**: How does this investment compare to what competitors spend?
4. **Cost Efficiency**: Is this the best use of budget vs alternatives?
5. **Risk Assessment**: What could go wrong? What's the downside?

Respond ONLY with strict JSON:
{"recommendation":"approve"|"reject"|"negotiate","confidence":number(0-100),"reasoning":string(3-5 sentences with specific market analysis and ROI projections),"riskFactors":string[],"strengths":string[],"marketAnalysis":string(2-3 sentences on market fit and competitive positioning),"recommendedAmount":number|null}

Be decisive and data-driven. Use the market benchmarks above to justify your analysis."""

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
