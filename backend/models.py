from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class Recommendation(str, Enum):
    APPROVE = "approve"
    REJECT = "reject"
    NEGOTIATE = "negotiate"


class BudgetAnalysisRequest(BaseModel):
    campaign_name: str
    category: str
    requested_amount: float
    final_amount: Optional[float] = None
    status: str = "pending_approval"
    justification: str
    requested_by: str = "Marketing Team"
    negotiation_log: str = ""


class BudgetAnalysisResponse(BaseModel):
    recommendation: Recommendation
    confidence: float = Field(ge=0, le=100)
    reasoning: str
    risk_factors: list[str] = []
    strengths: list[str] = []
    provider: str = "gemini"


class IncidentAnalysisRequest(BaseModel):
    incident_number: str
    title: str
    category: str
    source_ip: str
    file_hash: Optional[str] = None
    evidence_summary: str = ""
    osint_scores: dict = {}


class IncidentAnalysisResponse(BaseModel):
    severity: str
    risk_score: int = Field(ge=0, le=100)
    decision: str  # monitor, block, escalate
    reasoning: str
    provider: str = "gemini"


class HealthResponse(BaseModel):
    status: str = "ok"
    gemini_configured: bool
    groq_configured: bool
    openrouter_configured: bool
