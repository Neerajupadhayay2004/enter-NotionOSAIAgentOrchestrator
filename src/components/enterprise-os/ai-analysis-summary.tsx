import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BudgetRequest } from "@/types/enterprise-os";
import {
  Brain,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  RefreshCw,
  Loader2,
} from "lucide-react";

const PYTHON_BACKEND_URL =
  import.meta.env.VITE_PYTHON_BACKEND_URL ?? "http://localhost:8000";

export interface AiAnalysisData {
  recommendation: "approve" | "reject" | "negotiate";
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  strengths: string[];
  marketAnalysis?: string;
  recommendedAmount?: number | null;
}

const RECOMMENDATION_ICONS: Record<
  string,
  { icon: typeof ThumbsUp; color: string; bg: string; border: string; label: string }
> = {
  approve: {
    icon: ThumbsUp,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/40",
    label: "Approve",
  },
  reject: {
    icon: ThumbsDown,
    color: "text-red-400",
    bg: "bg-red-500/20",
    border: "border-red-500/40",
    label: "Reject",
  },
  negotiate: {
    icon: TrendingUp,
    color: "text-amber-400",
    bg: "bg-amber-500/20",
    border: "border-amber-500/40",
    label: "Negotiate",
  },
};

export function AiAnalysisSummary({
  request,
  compact = false,
}: {
  request: BudgetRequest;
  compact?: boolean;
}) {
  const [analysis, setAnalysis] = useState<AiAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/api/ai/analyze-budget`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_name: request.campaign_name,
          category: request.category,
          requested_amount: Number(request.requested_amount),
          final_amount: request.final_amount != null ? Number(request.final_amount) : null,
          status: request.status,
          justification: request.justification,
          requested_by: request.requested_by,
        }),
      });
      if (!response.ok) throw new Error(`AI service returned ${response.status}`);
      const data = await response.json();
      setAnalysis({
        recommendation: data.recommendation,
        confidence: data.confidence,
        reasoning: data.reasoning,
        riskFactors: data.risk_factors ?? [],
        strengths: data.strengths ?? [],
        marketAnalysis: data.market_analysis,
        recommendedAmount: data.recommended_amount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI analysis unavailable");
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (request.status === "pending_approval" || request.status === "negotiating") {
      fetchAnalysis();
    }
  }, [request.status, fetchAnalysis]);

  if (request.status !== "pending_approval" && request.status !== "negotiating") {
    return null;
  }

  if (isLoading && !analysis) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
        <span className="text-sm text-violet-300 font-medium">AI is analyzing this request...</span>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <span className="text-sm text-amber-300 font-medium">AI analysis unavailable</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); fetchAnalysis(); }}
          className="ml-auto h-7 px-2.5 text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!analysis) return null;

  const config = RECOMMENDATION_ICONS[analysis.recommendation];
  const Icon = config.icon;

  if (compact) {
    return (
      <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        {/* Recommendation + Confidence row */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${config.bg} border ${config.border}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
            <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
          </div>
          <span className="text-sm font-bold text-white">{Math.round(analysis.confidence)}% confidence</span>
          {analysis.recommendedAmount != null && (
            <span className="text-sm font-bold text-amber-400">
              Recommended: ${Number(analysis.recommendedAmount).toLocaleString()}
            </span>
          )}
        </div>

        {/* Confidence bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${
              analysis.confidence >= 75
                ? "from-emerald-500 to-emerald-400"
                : analysis.confidence >= 50
                  ? "from-amber-500 to-amber-400"
                  : "from-red-500 to-red-400"
            }`}
            style={{ width: `${analysis.confidence}%` }}
          />
        </div>

        {/* Strengths and risks */}
        <div className="flex flex-wrap gap-1.5">
          {analysis.strengths.slice(0, 2).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {s}
            </span>
          ))}
          {analysis.riskFactors.slice(0, 1).map((r) => (
            <span key={r} className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {r}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // Full panel
  return (
    <div className="rounded-xl border border-violet-500/30 bg-slate-900/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Brain className="h-5 w-5 text-violet-400" />
          <span className="text-sm font-bold uppercase tracking-wider text-violet-300">AI Analysis</span>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAnalysis} disabled={isLoading} className="h-7 px-2.5 text-sm">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 ${config.bg} border ${config.border}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
        </div>
        <span className="text-lg font-bold text-white">{Math.round(analysis.confidence)}%</span>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            analysis.confidence >= 75
              ? "from-emerald-500 to-emerald-400"
              : analysis.confidence >= 50
                ? "from-amber-500 to-amber-400"
                : "from-red-500 to-red-400"
          }`}
          style={{ width: `${analysis.confidence}%` }}
        />
      </div>

      {analysis.marketAnalysis && (
        <div className="rounded-lg border border-sky-500/25 bg-sky-950/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-bold uppercase tracking-wider text-sky-300">Market Analysis</span>
          </div>
          <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{analysis.marketAnalysis}</p>
        </div>
      )}

      <div className="rounded-lg border border-violet-500/20 bg-slate-950/60 p-4">
        <p className="text-sm font-bold uppercase tracking-wider text-violet-400 mb-2">AI Reasoning</p>
        <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{analysis.reasoning}</p>
      </div>

      {analysis.recommendedAmount != null && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/35 bg-amber-950/50 px-4 py-3">
          <TrendingUp className="h-5 w-5 text-amber-400" />
          <span className="text-sm text-amber-100">
            AI Recommended Target:{" "}
            <span className="font-extrabold text-amber-300 text-lg">
              ${Number(analysis.recommendedAmount).toLocaleString()}
            </span>
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {analysis.strengths.slice(0, 4).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-950/60 px-3 py-1.5 text-sm font-semibold text-emerald-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {s}
          </span>
        ))}
        {analysis.riskFactors.slice(0, 4).map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-950/60 px-3 py-1.5 text-sm font-semibold text-red-200">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
