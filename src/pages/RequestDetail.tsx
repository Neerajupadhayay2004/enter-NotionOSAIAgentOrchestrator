import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/enterprise-os/status-badge";
import { ActionTimeline } from "@/components/enterprise-os/action-timeline";
import { ApprovalActions } from "@/components/enterprise-os/approval-actions";
import { AiRecommendationPanel } from "@/components/enterprise-os/approval-panel";
import { useBudgetRequest, useBudgetRequests } from "@/hooks/use-budget-requests";
import { useBudgetNegotiation } from "@/hooks/use-budget-negotiation";
import { useConvexBudgetSync } from "@/hooks/use-convex-budget";
import { ArrowLeft, Github, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const RequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { request, actions, isLoading, refetch } = useBudgetRequest(id);
  const { deleteRequest } = useBudgetRequests();
  const { syncDecision, syncAiReview, syncDelete } = useConvexBudgetSync(request);
  const { negotiate, isNegotiating } = useBudgetNegotiation();

  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDecision = useCallback(async (status: string) => {
    setOptimisticStatus(status);
    setTimeout(() => refetch(), 200);
    setTimeout(() => refetch(), 1500);
    syncDecision(status).catch(() => {});
  }, [syncDecision, refetch]);

  const handleRetryNegotiation = async () => {
    if (!id) return;
    const result = await negotiate(id);
    if (result.success) {
      toast.success(`AI decision: ${result.status}`);
    } else {
      toast.error("AI analysis failed");
    }
    refetch();
  };

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      await deleteRequest(id);
      await syncDelete();
      toast.success("Request deleted successfully");
      navigate("/budget-os");
    } catch (err) {
      toast.error("Failed to delete request");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-center text-muted-foreground">
        {t("requestDetail.notFound")}
        <div className="mt-4">
          <Link to="/budget-os" className="text-sm text-primary underline underline-offset-4">{t("requestDetail.backToDashboard")}</Link>
        </div>
      </div>
    );
  }

  const displayStatus = optimisticStatus ?? request.status;
  const showApprovalPanel = displayStatus === "pending_approval" || displayStatus === "negotiating";
  const isPendingDecision = displayStatus === "pending_approval";

  return (
    <div className="min-h-full bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <Link to="/budget-os" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("requestDetail.backLink")}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{request.campaign_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("requestDetail.requestedBy", { category: request.category, name: request.requested_by })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {request.status === "negotiating" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryNegotiation}
                  disabled={isNegotiating}
                  className="border-violet-500/40 text-violet-400 hover:border-violet-500/60 hover:bg-violet-500/10"
                >
                  {isNegotiating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Re-run AI
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
              <StatusBadge status={displayStatus} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {showApprovalPanel && (
          <>
            <AiRecommendationPanel
              requestId={request.id}
              enabled
              request={request}
              onReviewLoaded={(review) => { syncAiReview(review); }}
            />
            <ApprovalActions
              requestId={request.id}
              onDecision={handleDecision}
              isPendingDecision={isPendingDecision}
            />
          </>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("requestDetail.outcome.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("requestDetail.outcome.requested")}</p>
              <p className="text-lg font-semibold">${Number(request.requested_amount).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("requestDetail.outcome.negotiated")}</p>
              <p className="text-lg font-semibold">
                {request.final_amount != null ? `$${Number(request.final_amount).toLocaleString()}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("requestDetail.outcome.status")}</p>
              <div className="text-lg font-semibold">
                <StatusBadge status={displayStatus} />
              </div>
            </div>
          </CardContent>
          {request.github_issue_url && (
            <CardContent className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" asChild>
                <a href={request.github_issue_url} target="_blank" rel="noreferrer">
                  <Github className="h-4 w-4" />
                  {t("requestDetail.viewGithubIssue")}
                </a>
              </Button>
            </CardContent>
          )}
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("requestDetail.timelineTitle")}
          </h2>
          <ActionTimeline actions={actions} />
        </div>
      </main>

      <AlertDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => !open && setShowDeleteConfirm(false)}
      >
        <AlertDialogContent className="border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Request
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this budget request? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RequestDetail;
