import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/enterprise-os/status-badge";
import type { BudgetRequest } from "@/types/enterprise-os";
import {
  CheckCircle2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  ArrowRight,
  Bot,
  RefreshCw,
  Shield,
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
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8" />
          <p>{t("approvals.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((request) => (
        <Card
          key={request.id}
          className={
            request.status === "pending_approval"
              ? "border-status-pending/40"
              : "border-status-negotiating/40"
          }
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{request.campaign_name}</p>
                <StatusBadge status={request.status} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.category} · $
                {Number(
                  request.final_amount ?? request.requested_amount,
                ).toLocaleString()}
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to={`/budget-os/requests/${request.id}`}>
                {request.status === "pending_approval"
                  ? t("approvals.reviewAndDecide")
                  : t("approvals.reviewAndNegotiate")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
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
}

const RECOMMENDATION_VARIANT: Record<
  AiReviewResult["recommendation"],
  "approved" | "rejected" | "negotiating"
> = {
  approve: "approved",
  reject: "rejected",
  negotiate: "negotiating",
};

const RECOMMENDATION_ICON: Record<
  AiReviewResult["recommendation"],
  React.ComponentType<{ className?: string }>
> = {
  approve: ThumbsUp,
  reject: ThumbsDown,
  negotiate: Sparkles,
};

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

      // Strategy 1: Try Python backend first (Gemini -> Groq -> OpenRouter chain)
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
          };
          setReview(result);
          setProvider(data.provider ?? "python-backend");
          onReviewLoaded?.(result);
          setIsLoading(false);
          return;
        }
      } catch (pyErr) {
        console.warn(
          "Python backend unavailable, trying Supabase edge function:",
          pyErr,
        );
      }

      // Strategy 2: Fallback to Supabase edge function (Gemini direct)
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
        };
        setReview(result);
        setProvider("supabase-gemini");
        onReviewLoaded?.(result);
      } catch (err) {
        if (!error) {
          setError(
            err instanceof Error ? err.message : t("aiReview.error"),
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, requestId, request, t, onReviewLoaded, error],
  );

  useEffect(() => {
    load();
  }, [load]);

  if (!enabled) return null;

  const Icon = review ? RECOMMENDATION_ICON[review.recommendation] : Sparkles;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("aiReview.title")}
          {provider && (
            <Badge variant="outline" className="ml-auto gap-1 text-xs">
              <Bot className="h-3 w-3" />
              {provider}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            {t("aiReview.analyzing")}
          </div>
        )}
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(true)}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        )}
        {review && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={RECOMMENDATION_VARIANT[review.recommendation]}
                className="gap-1"
              >
                <Icon className="h-3 w-3" />
                {t(`aiReview.recommendation.${review.recommendation}`)}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {t("aiReview.confidence", {
                  value: Math.round(review.confidence),
                })}
              </span>
              {review.cached && (
                <span className="text-xs text-muted-foreground">
                  ({t("aiReview.cached")})
                </span>
              )}
            </div>
            <p className="text-sm">{review.reasoning}</p>
            {review.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("aiReview.strengths")}
                </p>
                <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                  {review.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {review.riskFactors.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("aiReview.risks")}
                </p>
                <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
                  {review.riskFactors.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className="gap-1 text-xs">
                <Shield className="h-3 w-3" />
                {t("aiReview.geminiPowered")}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => load(true)}
                disabled={isLoading}
              >
                <RefreshCw className="h-3 w-3" />
                {t("aiReview.reanalyze")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
