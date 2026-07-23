import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/enterprise-os/status-badge";
import type { BudgetRequest } from "@/types/enterprise-os";
import {
  CheckCircle2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Bot,
  RefreshCw,
  Shield,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Brain,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PYTHON_BACKEND_URL =
  import.meta.env.VITE_PYTHON_BACKEND_URL ?? "http://localhost:8000";

export function PendingBudgetApprovals({
  requests,
}: {
  requests: BudgetRequest[];
}) {
  const { t } = useTranslation();
  const pending = requests.filter(
    (r) => r.status === "pending_approval" || r.status === "negotiating",
  );

  if (pending.length === 0) {
    return (
      <Card className="border-white/10 bg-slate-900/80">
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm">{t("approvals.empty")}</p>
            <p className="mt-0.5 text-xs text-slate-400">All caught up — no pending approvals</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {pending.map((request) => (
        <div
          key={request.id}
          className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg ${
            request.status === "pending_approval"
              ? "border-violet-500/40 bg-slate-900/90 hover:border-violet-500/70"
              : "border-amber-500/40 bg-slate-900/90 hover:border-amber-500/70"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-100 text-sm">{request.campaign_name}</p>
                <StatusBadge status={request.status} />
              </div>
              <p className="mt-1 text-xs text-slate-300">
                {request.category} ·{" "}
                <span className="font-bold text-emerald-400">
                  ${Number(request.final_amount ?? request.requested_amount).toLocaleString()}
                </span>
              </p>
            </div>
            <Button
              size="sm"
              asChild
              className="gap-1.5 bg-violet-600 text-white hover:bg-violet-500 font-semibold"
            >
              <Link to={`/budget-os/requests/${request.id}`}>
                {request.status === "pending_approval"
                  ? t("approvals.reviewAndDecide")
                  : t("approvals.reviewAndNegotiate")}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface AiReviewResult {
  recommendation: "approve" | "reject" | "negotiate";
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  strengths: string[];
  cached?: boolean;
  marketAnalysis?: string;
  recommendedAmount?: number | null;
}

const RECOMMENDATION_CONFIG: Record<
  AiReviewResult["recommendation"],
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string; border: string }
> = {
  approve: {
    icon: ThumbsUp,
    color: "text-emerald-300 font-bold",
    bg: "bg-emerald-950/80",
    label: "Recommend Approve",
    border: "border-emerald-500/60",
  },
  reject: {
    icon: ThumbsDown,
    color: "text-red-300 font-bold",
    bg: "bg-red-950/80",
    label: "Recommend Reject",
    border: "border-red-500/60",
  },
  negotiate: {
    icon: TrendingUp,
    color: "text-amber-300 font-bold",
    bg: "bg-amber-950/80",
    label: "Recommend Negotiate",
    border: "border-amber-500/60",
  },
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color =
    confidence >= 75
      ? "from-emerald-500 to-emerald-400"
      : confidence >= 50
        ? "from-amber-500 to-amber-400"
        : "from-red-500 to-red-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-slate-300">AI Confidence Score</span>
        <span className="font-bold text-white text-sm">{Math.round(confidence)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}

export function AiRecommendationPanel({
  requestId,
  enabled,
  onReviewLoaded,
  request,
}: {
  requestId: string;
  enabled: boolean;
  onReviewLoaded?: (review: AiReviewResult) => void;
  request?: BudgetRequest | null;
}) {
  const { t } = useTranslation();
  const [review, setReview] = useState<AiReviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("");

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!enabled) return;
      setIsLoading(true);
      setError(null);

      // Strategy 1: Python backend (Gemini → Groq → OpenRouter chain)
      try {
        const body: Record<string, unknown> = { requestId };
        if (request) {
          body.campaign_name = request.campaign_name;
          body.category = request.category;
          body.requested_amount = Number(request.requested_amount);
          body.final_amount =
            request.final_amount != null ? Number(request.final_amount) : null;
          body.status = request.status;
          body.justification = request.justification;
          body.requested_by = request.requested_by;
        }

        const response = await fetch(
          `${PYTHON_BACKEND_URL}/api/ai/analyze-budget`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );

        if (response.ok) {
          const data = await response.json();
          const result: AiReviewResult = {
            recommendation: data.recommendation,
            confidence: data.confidence,
            reasoning: data.reasoning,
            riskFactors: data.risk_factors ?? [],
            strengths: data.strengths ?? [],
            cached: false,
            marketAnalysis: data.market_analysis ?? undefined,
            recommendedAmount: data.recommended_amount ?? null,
          };
          setReview(result);
          setProvider(data.provider ?? "python-backend");
          onReviewLoaded?.(result);
          setIsLoading(false);
          return;
        }
      } catch (pyErr) {
        console.warn("Python backend unavailable, trying Supabase edge function:", pyErr);
      }

      // Strategy 2: Supabase edge function (Gemini direct)
      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          "ai-budget-review",
          {
            body: { requestId, forceRefresh },
          },
        );
        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        const result: AiReviewResult = {
          recommendation: data.recommendation,
          confidence: data.confidence,
          reasoning: data.reasoning,
          riskFactors: data.riskFactors ?? [],
          strengths: data.strengths ?? [],
          cached: data.cached ?? false,
          marketAnalysis: data.marketAnalysis ?? undefined,
          recommendedAmount: data.recommendedAmount ?? null,
        };
        setReview(result);
        setProvider("supabase-gemini");
        onReviewLoaded?.(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("aiReview.error"));
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, requestId, request, t, onReviewLoaded],
  );

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled) return null;

  const config = review ? RECOMMENDATION_CONFIG[review.recommendation] : null;

  return (
    <div className="overflow-hidden rounded-xl border border-violet-500/30 bg-slate-900/95 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="border-b border-violet-500/20 bg-slate-950/90 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/30 text-violet-300 border border-violet-500/40">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-white tracking-wide">
                {t("aiReview.title")}
              </p>
              <p className="text-xs font-medium text-slate-300">Gemini 2.0 Flash Market Intelligence</p>
            </div>
          </div>
          {provider && (
            <Badge variant="outline" className="gap-1 border-violet-400/40 bg-violet-950/60 text-xs font-semibold text-violet-200">
              <Bot className="h-3.5 w-3.5" />
              {provider}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5 text-slate-100">
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-3.5 rounded-xl border border-violet-500/20 bg-slate-950/80 p-5">
            <div className="relative h-9 w-9 shrink-0">
              <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/40" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-white">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{t("aiReview.analyzing")}</p>
              <p className="text-xs text-slate-300">Evaluating benchmarks & ROI projections via Gemini AI...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="space-y-3 rounded-xl border border-red-500/40 bg-red-950/60 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <p className="text-sm font-bold text-red-200">Analysis unavailable</p>
            </div>
            <p className="text-xs text-red-300 leading-relaxed">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(true)}
              disabled={isLoading}
              className="border-red-500/40 bg-red-900/30 text-red-200 hover:bg-red-900/60 font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Analysis
            </Button>
          </div>
        )}

        {/* Result */}
        {review && config && !isLoading && (
          <div className="space-y-4">
            {/* Recommendation badge + confidence */}
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`flex items-center gap-2.5 rounded-full px-4 py-2 ${config.bg} border ${config.border}`}
              >
                <config.icon className={`h-4 w-4 ${config.color}`} />
                <span className={`text-sm ${config.color}`}>
                  {config.label}
                </span>
              </div>
              {review.cached && (
                <span className="text-xs font-medium text-slate-400">(cached)</span>
              )}
            </div>

            {/* Confidence bar */}
            <ConfidenceBar confidence={review.confidence} />

            {/* Market analysis */}
            {review.marketAnalysis && (
              <div className="rounded-xl border border-sky-500/30 bg-sky-950/40 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-sky-300" />
                  <p className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Market Analysis & Benchmarks
                  </p>
                </div>
                <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-normal">
                  {review.marketAnalysis}
                </p>
              </div>
            )}

            {/* AI Reasoning */}
            <div className="rounded-xl border border-violet-500/30 bg-slate-950/80 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-300" />
                <p className="text-xs font-bold uppercase tracking-wider text-violet-300">
                  Detailed AI Reasoning & ROI Evaluation
                </p>
              </div>
              <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-wrap font-normal">
                {review.reasoning}
              </p>
            </div>

            {/* Recommended amount if different */}
            {review.recommendedAmount != null && (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/50 px-4 py-3">
                <TrendingUp className="h-5 w-5 text-amber-400" />
                <p className="text-sm text-amber-100">
                  AI Recommended Target:{" "}
                  <span className="font-extrabold text-amber-300 text-base">
                    ${Number(review.recommendedAmount).toLocaleString()}
                  </span>
                </p>
              </div>
            )}

            {/* Strengths */}
            {review.strengths.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Key Strengths & Value Drivers
                </p>
                <div className="flex flex-wrap gap-2">
                  {review.strengths.map((s) => (
                    <span
                      key={s}
                      className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Risk factors */}
            {review.riskFactors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-red-400">
                  Risk Factors & Considerations
                </p>
                <div className="flex flex-wrap gap-2">
                  {review.riskFactors.map((r) => (
                    <span
                      key={r}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/70 px-3 py-1.5 text-xs font-semibold text-red-200"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <Badge variant="outline" className="gap-1.5 border-violet-500/40 bg-violet-950/50 text-xs font-semibold text-violet-300">
                <Shield className="h-3.5 w-3.5" />
                {t("aiReview.geminiPowered")}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => load(true)}
                disabled={isLoading}
                className="h-8 gap-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("aiReview.reanalyze")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
