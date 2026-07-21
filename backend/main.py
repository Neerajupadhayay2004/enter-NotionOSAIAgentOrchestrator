import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import (
    BudgetAnalysisRequest, BudgetAnalysisResponse,
    IncidentAnalysisRequest, IncidentAnalysisResponse,
    HealthResponse,
)
from ai_engine import analyze_budget, analyze_security_incident

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Enterprise AI Backend starting...")
    logger.info(f"Gemini configured: {bool(os.getenv('GEMINI_API_KEY'))}")
    logger.info(f"Groq configured: {bool(os.getenv('GROQ_API_KEY'))}")
    logger.info(f"OpenRouter configured: {bool(os.getenv('OPENROUTER_API_KEY'))}")
    yield
    logger.info("Enterprise AI Backend shutting down...")


app = FastAPI(
    title="Enterprise AI Backend",
    description="AI-powered analysis for Budget OS and CyberGuard Security OS",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        gemini_configured=bool(os.getenv("GEMINI_API_KEY")),
        groq_configured=bool(os.getenv("GROQ_API_KEY")),
        openrouter_configured=bool(os.getenv("OPENROUTER_API_KEY")),
    )


@app.post("/api/ai/analyze-budget", response_model=BudgetAnalysisResponse)
async def api_analyze_budget(req: BudgetAnalysisRequest):
    try:
        result = await analyze_budget(
            campaign_name=req.campaign_name,
            category=req.category,
            requested_amount=req.requested_amount,
            final_amount=req.final_amount,
            status=req.status,
            justification=req.justification,
            requested_by=req.requested_by,
            negotiation_log=req.negotiation_log,
        )
        return BudgetAnalysisResponse(**result)
    except Exception as e:
        logger.error(f"Budget analysis failed: {e}")
        # Return a safe default instead of crashing
        return BudgetAnalysisResponse(
            recommendation="negotiate",
            confidence=30,
            reasoning=f"AI analysis encountered an error: {str(e)[:200]}. Manual review recommended.",
            risk_factors=["AI provider unavailable"],
            strengths=[],
            provider="fallback",
        )


@app.post("/api/ai/analyze-incident", response_model=IncidentAnalysisResponse)
async def api_analyze_incident(req: IncidentAnalysisRequest):
    try:
        result = await analyze_security_incident(
            incident_number=req.incident_number,
            title=req.title,
            category=req.category,
            source_ip=req.source_ip,
            file_hash=req.file_hash,
            evidence_summary=req.evidence_summary,
            osint_scores=req.osint_scores,
        )
        return IncidentAnalysisResponse(**result)
    except Exception as e:
        logger.error(f"Incident analysis failed: {e}")
        return IncidentAnalysisResponse(
            severity="medium",
            risk_score=50,
            decision="escalate",
            reasoning=f"AI analysis encountered an error: {str(e)[:200]}. Human review required.",
            provider="fallback",
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
