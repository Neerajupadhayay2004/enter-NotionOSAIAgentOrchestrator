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
  Sparkles,
  Hand,
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

const PYTHON_BACKEND_URL =
  import.meta.env.VITE_PYTHON_BACKEND_URL ?? "http://localhost:8000";

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
    try {
      let data: Record<string, unknown> | null = null;
      let usedSupabase = false;

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
          data = result.data;
          usedSupabase = true;
        }
      } catch (sbErr) {
        console.warn("Supabase edge function failed:", sbErr);
      }

      if (!usedSupabase) {
        try {
          const response = await fetch(
            `${PYTHON_BACKEND_URL}/api/ai/analyze-budget`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                requestId,
                decision,
                notes: notes.trim(),
              }),
            },
          );
          if (response.ok) {
            data = await response.json();
          }
        } catch (pyErr) {
          console.warn("Python backend also failed:", pyErr);
        }
      }

      if (!data) {
        const newStatus = decision === "approve" ? "completed" : "rejected";
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
            source: "in-app",
          },
        });

        data = { status: newStatus };
      }

      toast.success(
        decision === "approve"
          ? t("approval.toastApproved")
          : t("approval.toastRejected"),
      );
      setPendingDecision(null);
      setNotes("");
      const newStatus =
        (data?.status as string) ??
        (decision === "approve" ? "completed" : "rejected");
      onDecision(newStatus);
    } catch (err) {
      console.error(err);
      toast.error(t("approval.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card className="border-agent-human/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4 text-agent-human" />
            {t("approval.title")}
            {!isPendingDecision && (
              <Badge variant="outline" className="ml-2 gap-1 text-xs">
                <Hand className="h-3 w-3" />
                {t("approval.earlyDecision")}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isPendingDecision
              ? t("approval.description")
              : t("approval.earlyDescription")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="approval-notes">
              {t("approval.notesLabel")}
            </Label>
            <Textarea
              id="approval-notes"
              placeholder={t("approval.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2 bg-status-approved hover:bg-status-approved/90"
              onClick={() => setPendingDecision("approve")}
              disabled={isSubmitting}
            >
              <ThumbsUp className="h-4 w-4" />
              {t("approval.approve")}
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => setPendingDecision("reject")}
              disabled={isSubmitting}
            >
              <ThumbsDown className="h-4 w-4" />
              {t("approval.reject")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingDecision !== null}
        onOpenChange={(open) => !open && setPendingDecision(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDecision === "approve"
                ? t("approval.confirmApprove")
                : t("approval.confirmReject")}
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
                pendingDecision === "reject"
                  ? "bg-destructive hover:bg-destructive/90"
                  : ""
              }
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
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
