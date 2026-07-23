import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Hand,
  TrendingUp,
  XCircle,
} from "lucide-react";
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

interface ApprovalActionsProps {
  requestId: string;
  onDecision: (status: string) => void;
  isPendingDecision?: boolean;
}

export function ApprovalActions({
  requestId,
  onDecision,
  isPendingDecision = true,
}: ApprovalActionsProps) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState("");
  const [pendingDecision, setPendingDecision] = useState<
    "approve" | "reject" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitDecision = async (decision: "approve" | "reject") => {
    setIsSubmitting(true);
    const newStatus = decision === "approve" ? "completed" : "rejected";

    try {
      // Strategy 1: Try Supabase edge function (handles Notion + GitHub sync)
      let succeeded = false;
      let finalStatus = newStatus;
      try {
        const result = await supabase.functions.invoke(
          "human-budget-decision",
          {
            body: {
              requestId,
              decision,
              notes: notes.trim() || undefined,
            },
          },
        );

        if (!result.error && !result.data?.error) {
          succeeded = true;
          finalStatus = result.data?.status || finalStatus;
        } else {
          console.warn("Supabase edge function returned error:", result.error ?? result.data?.error);
        }
      } catch (sbErr) {
        console.warn("Supabase edge function invocation failed:", sbErr);
      }

      // Strategy 2: Direct Supabase DB update as reliable fallback
      // This always runs if edge function fails, ensuring the UI is never stuck.
      if (!succeeded) {
        console.info("Falling back to direct Supabase update for decision:", decision);
        const { error: updateError } = await supabase
          .from("budget_requests")
          .update({ status: newStatus })
          .eq("id", requestId);

        if (updateError) throw updateError;

        await supabase.from("agent_actions").insert({
          request_id: requestId,
          actor: "human",
          action_type: "human_decision",
          amount: null,
          reasoning:
            notes.trim() ||
            `Human ${decision === "approve" ? "approved" : "rejected"} the budget.`,
          payload: {
            status: decision === "approve" ? "Approved" : "Rejected",
            source: "in-app-direct",
          },
        });
      }

      // Always notify parent component to sync to Convex and update UI
      onDecision(finalStatus);
    } catch (err) {
      console.error("Decision submission failed:", err);
      toast.error(t("approval.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Board Decision Card */}
      <Card className="overflow-hidden border-0 shadow-xl">
        {/* Premium gradient header */}
        <div className={`px-5 py-4 ${
          isPendingDecision
            ? "bg-gradient-to-r from-violet-600/20 via-indigo-600/20 to-violet-600/20 border-b border-violet-500/30"
            : "bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-amber-600/20 border-b border-amber-500/30"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                isPendingDecision ? "bg-violet-500/20" : "bg-amber-500/20"
              }`}>
                <UserCheck className={`h-4 w-4 ${isPendingDecision ? "text-violet-400" : "text-amber-400"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t("approval.title")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPendingDecision ? "Final authority — your decision is binding" : "Override in progress"}
                </p>
              </div>
            </div>
            {!isPendingDecision && (
              <Badge variant="outline" className="gap-1 border-amber-500/40 text-xs text-amber-400">
                <Hand className="h-3 w-3" />
                {t("approval.earlyDecision")}
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            {isPendingDecision
              ? t("approval.description")
              : t("approval.earlyDescription")}
          </p>

          <div className="space-y-2">
            <Label htmlFor="approval-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("approval.notesLabel")}
            </Label>
            <Textarea
              id="approval-notes"
              placeholder={t("approval.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none border-border/60 bg-background/50 text-sm focus:border-primary/50"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-900/40"
              onClick={() => setPendingDecision("approve")}
              disabled={isSubmitting}
            >
              <TrendingUp className="h-4 w-4" />
              {t("approval.approve")}
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 border-red-500/40 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => setPendingDecision("reject")}
              disabled={isSubmitting}
            >
              <XCircle className="h-4 w-4" />
              {t("approval.reject")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => !open && setPendingDecision(null)}
      >
        <AlertDialogContent className="border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingDecision === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  {t("approval.confirmApprove")}
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  {t("approval.confirmReject")}
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDecision === "approve"
                ? t("approval.confirmApproveDesc")
                : t("approval.confirmRejectDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              {t("approval.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                if (pendingDecision) submitDecision(pendingDecision);
              }}
              className={
                pendingDecision === "approve"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400"
                  : "bg-gradient-to-r from-red-700 to-red-600 text-white hover:from-red-600 hover:to-red-500"
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {pendingDecision === "approve" ? (
                    <ThumbsUp className="h-4 w-4" />
                  ) : (
                    <ThumbsDown className="h-4 w-4" />
                  )}
                  {pendingDecision === "approve"
                    ? t("approval.approve")
                    : t("approval.reject")}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
