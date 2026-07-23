import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/enterprise-os/status-badge";
import { AiAnalysisSummary } from "@/components/enterprise-os/ai-analysis-summary";
import { useBudgetNegotiation } from "@/hooks/use-budget-negotiation";
import type { BudgetRequest } from "@/types/enterprise-os";
import {
  ArrowRight,
  Inbox,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  Trash2,
  Loader2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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

type FilterTab = "all" | "pending" | "approved" | "rejected";

export function RequestList({
  requests,
  onRetryComplete,
  onDelete,
  onDecision,
}: {
  requests: BudgetRequest[];
  onRetryComplete?: () => void;
  onDelete?: (requestId: string) => Promise<void>;
  onDecision?: (requestId: string, decision: "approve" | "reject", notes?: string) => Promise<{ success: boolean; status: string }>;
}) {
  const { t } = useTranslation();
  const { negotiate } = useBudgetNegotiation();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [decisionLoadingId, setDecisionLoadingId] = useState<string | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<{
    requestId: string;
    decision: "approve" | "reject";
  } | null>(null);

  const counts = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === "pending_approval").length,
      approved: requests.filter(
        (r) => r.status === "approved" || r.status === "completed"
      ).length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    switch (activeTab) {
      case "pending":
        return requests.filter((r) => r.status === "pending_approval" || r.status === "negotiating");
      case "approved":
        return requests.filter(
          (r) => r.status === "approved" || r.status === "completed"
        );
      case "rejected":
        return requests.filter((r) => r.status === "rejected");
      default:
        return requests;
    }
  }, [requests, activeTab]);

  const handleRetry = async (requestId: string) => {
    setRetryingId(requestId);
    const result = await negotiate(requestId);
    setRetryingId(null);
    if (result.success) {
      toast.success(`AI decision: ${result.status}`);
    } else {
      toast.error("AI analysis failed, try again");
    }
    onRetryComplete?.();
  };

  const handleDelete = async (requestId: string) => {
    if (!onDelete) return;
    setDeletingId(requestId);
    try {
      await onDelete(requestId);
      toast.success("Request deleted successfully");
    } catch (err) {
      toast.error("Failed to delete request");
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  };

  const handleInlineDecision = async (requestId: string, decision: "approve" | "reject") => {
    if (!onDecision) return;
    setDecisionLoadingId(requestId);
    try {
      const result = await onDecision(requestId, decision);
      if (result.success) {
        toast.success(`Request ${decision === "approve" ? "approved" : "rejected"} successfully`);
      }
    } catch (err) {
      toast.error(`Failed to ${decision} request`);
    } finally {
      setDecisionLoadingId(null);
      setConfirmDecision(null);
    }
  };

  if (requests.length === 0) {
    return (
      <Card className="border-white/5 bg-white/[0.02]">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 text-muted-foreground/60" />
          <p className="font-semibold text-foreground text-base">{t("home.requestsList.empty")}</p>
          <p className="text-sm text-muted-foreground">Submit a budget request on the left to start</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs Header */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2 backdrop-blur-sm">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "all"
              ? "bg-violet-600 text-white shadow-md shadow-violet-900/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          All
          <Badge
            variant="secondary"
            className={`h-5 px-2 text-xs ${
              activeTab === "all" ? "bg-white/20 text-white" : "bg-white/5 text-muted-foreground"
            }`}
          >
            {counts.all}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "pending"
              ? "bg-amber-600 text-white shadow-md shadow-amber-900/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <Clock className="h-4 w-4 text-amber-300" />
          Pending
          <Badge
            variant="secondary"
            className={`h-5 px-2 text-xs ${
              activeTab === "pending" ? "bg-white/20 text-white" : "bg-white/5 text-muted-foreground"
            }`}
          >
            {counts.pending}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("approved")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "approved"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          Approved
          <Badge
            variant="secondary"
            className={`h-5 px-2 text-xs ${
              activeTab === "approved" ? "bg-white/20 text-white" : "bg-white/5 text-muted-foreground"
            }`}
          >
            {counts.approved}
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("rejected")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
            activeTab === "rejected"
              ? "bg-red-600 text-white shadow-md shadow-red-900/30"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <XCircle className="h-4 w-4 text-red-300" />
          Rejected
          <Badge
            variant="secondary"
            className={`h-5 px-2 text-xs ${
              activeTab === "rejected" ? "bg-white/20 text-white" : "bg-white/5 text-muted-foreground"
            }`}
          >
            {counts.rejected}
          </Badge>
        </button>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          No requests found in this category.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const isApproved = request.status === "approved" || request.status === "completed";
            const isRejected = request.status === "rejected";
            const isPending = request.status === "pending_approval" || request.status === "negotiating";
            const isDeciding = decisionLoadingId === request.id;

            const cardBorder = isApproved
              ? "border-l-4 border-l-emerald-500 border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-transparent to-transparent"
              : isRejected
              ? "border-l-4 border-l-red-500 border-red-500/20 bg-gradient-to-r from-red-950/20 via-transparent to-transparent"
              : "border-l-4 border-l-amber-500 border-amber-500/20 bg-gradient-to-r from-amber-950/20 via-transparent to-transparent";

            return (
              <div key={request.id}>
                <Link to={`/budget-os/requests/${request.id}`} className="block">
                  <Card
                    className={`transition-all duration-200 hover:scale-[1.01] hover:shadow-lg ${cardBorder}`}
                  >
                    <CardContent className="p-5 space-y-3">
                      {/* Top row: Title + Status + Actions */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-2">
                          {/* Title + Status Badge */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            {isApproved && (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                            )}
                            {isRejected && (
                              <XCircle className="h-5 w-5 shrink-0 text-red-400" />
                            )}
                            {isPending && (
                              <Zap className="h-5 w-5 shrink-0 text-amber-400 animate-pulse" />
                            )}
                            <p className="font-bold text-foreground text-base tracking-tight">
                              {request.campaign_name}
                            </p>
                            <StatusBadge status={request.status} />
                          </div>

                          {/* Summary details */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="rounded-md bg-white/5 px-2.5 py-1 font-semibold text-foreground/90">
                              {request.category}
                            </span>
                            <span>
                              Requested:{" "}
                              <span className="font-bold text-foreground">
                                ${Number(request.requested_amount).toLocaleString()}
                              </span>
                            </span>
                            {request.final_amount != null && request.final_amount !== request.requested_amount && (
                              <span className="flex items-center gap-1 font-bold text-emerald-400">
                                <TrendingUp className="h-3.5 w-3.5" />
                                Final: ${Number(request.final_amount).toLocaleString()}
                              </span>
                            )}
                            {request.requested_by && (
                              <span className="text-muted-foreground/80">
                                by {request.requested_by}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Inline Approve/Reject for pending items */}
                          {isPending && onDecision && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmDecision({ requestId: request.id, decision: "approve" });
                                }}
                                disabled={isDeciding}
                                className="h-9 w-9 p-0 hover:bg-emerald-500/20 text-emerald-400"
                                title="Approve"
                              >
                                {isDeciding ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <ThumbsUp className="h-5 w-5" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmDecision({ requestId: request.id, decision: "reject" });
                                }}
                                disabled={isDeciding}
                                className="h-9 w-9 p-0 hover:bg-red-500/20 text-red-400"
                                title="Reject"
                              >
                                <ThumbsDown className="h-5 w-5" />
                              </Button>
                            </>
                          )}

                          {/* Retry AI for negotiating */}
                          {request.status === "negotiating" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRetry(request.id);
                              }}
                              disabled={retryingId === request.id}
                              className="h-9 w-9 p-0 hover:bg-violet-500/20 text-violet-400"
                              title="Re-run AI analysis"
                            >
                              {retryingId === request.id ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-5 w-5" />
                              )}
                            </Button>
                          )}

                          {/* Delete */}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeleteConfirmId(request.id);
                              }}
                              disabled={deletingId === request.id}
                              className="h-9 w-9 p-0 hover:bg-red-500/20 text-red-400"
                            >
                              {deletingId === request.id ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Trash2 className="h-5 w-5" />
                              )}
                            </Button>
                          )}

                          <ArrowRight className="h-5 w-5 text-muted-foreground/60" />
                        </div>
                      </div>

                      {/* AI Analysis Summary for pending items */}
                      {isPending && (
                        <AiAnalysisSummary request={request} compact />
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
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
            <AlertDialogCancel disabled={deletingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId);
                }
              }}
              className="bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500"
            >
              {deletingId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve/Reject Confirmation Dialog */}
      <AlertDialog
        open={confirmDecision !== null}
        onOpenChange={(open) => !open && setConfirmDecision(null)}
      >
        <AlertDialogContent className="border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmDecision?.decision === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Approve Budget Request?
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Reject Budget Request?
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDecision?.decision === "approve"
                ? "This will approve the budget. A GitHub issue will be created for execution."
                : "This will reject the budget request. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decisionLoadingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={decisionLoadingId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDecision) {
                  handleInlineDecision(confirmDecision.requestId, confirmDecision.decision);
                }
              }}
              className={
                confirmDecision?.decision === "approve"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400"
                  : "bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500"
              }
            >
              {decisionLoadingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmDecision?.decision === "approve" ? (
                <>
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Approve
                </>
              ) : (
                <>
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Reject
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
