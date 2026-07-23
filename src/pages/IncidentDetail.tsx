import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IncidentStatusBadge } from "@/components/cyberguard/incident-status-badge";
import { SeverityBadge } from "@/components/cyberguard/severity-badge";
import { IncidentTimeline } from "@/components/cyberguard/incident-timeline";
import { EvidencePanel } from "@/components/cyberguard/evidence-card";
import { PipelineStepTracker } from "@/components/cyberguard/pipeline-step-tracker";
import { LiveConsoleLog } from "@/components/cyberguard/live-console-log";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CATEGORY_LABEL_KEYS } from "@/types/cyberguard";
import { useIncidentDetail, useSecurityIncidents } from "@/hooks/use-security-incidents";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  ShieldOff,
  ExternalLink,
  Bot,
  User,
} from "lucide-react";

const IncidentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { incident, evidence, actions, isLoading, refetch } = useIncidentDetail(id);
  const { approveIncident, blockIncident } = useSecurityIncidents();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "block">("approve");
  const [dialogActor, setDialogActor] = useState<"human" | "ai">("human");
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");

  const aiReasoning = useMemo(() => {
    const decideAction = actions.find((a) => a.action_type === "decide");
    return decideAction?.reasoning || null;
  }, [actions]);

  const handleDecision = async () => {
    if (!incident) return;
    setIsProcessing(true);
    try {
      if (dialogAction === "approve") {
        await approveIncident(incident.id, notes || undefined, dialogActor);
        toast({
          title: dialogActor === "ai" ? t("cyberguard.decision.aiToastApproved") : t("cyberguard.decision.toastApproved"),
          description: t("cyberguard.decision.toastApprovedDesc", {
            number: incident.incident_number,
          }),
        });
      } else {
        await blockIncident(incident.id, notes || undefined, dialogActor);
        toast({
          title: dialogActor === "ai" ? t("cyberguard.decision.aiToastBlocked") : t("cyberguard.decision.toastBlocked"),
          description: t("cyberguard.decision.toastBlockedDesc", {
            number: incident.incident_number,
            ip: incident.source_ip,
          }),
        });
      }
      setDialogOpen(false);
      setNotes("");
      refetch();
    } catch {
      toast({
        title: t("cyberguard.decision.toastError"),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-center text-muted-foreground">
        {t("cyberguard.detail.notFound")}
        <div className="mt-4">
          <Link to="/" className="text-sm text-primary underline underline-offset-4">{t("cyberguard.detail.backToDashboard")}</Link>
        </div>
      </div>
    );
  }

  const isPending = incident.status === "pending_approval";

  return (
    <div className="min-h-full bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("cyberguard.detail.backLink")}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{incident.incident_number}</span>
                <h1 className="text-xl font-semibold">{incident.title}</h1>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(CATEGORY_LABEL_KEYS[incident.category])} · {incident.source_ip}
                {incident.file_hash && <span className="font-mono"> · {incident.file_hash}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <SeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        {isPending && (
          <Card className="border-status-pending/40">
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{t("cyberguard.detail.pendingAction")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("cyberguard.detail.pendingActionDesc")}
                  </p>
                </div>
                {incident.notion_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={incident.notion_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      {t("cyberguard.detail.viewInNotion")}
                    </a>
                  </Button>
                )}
              </div>

              {aiReasoning && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                    <Bot className="h-4 w-4" />
                    {t("cyberguard.decision.aiRecommendation")}
                    {incident.decision && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase dark:bg-blue-900">
                        {incident.decision}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{aiReasoning}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950"
                  onClick={() => { setDialogAction(incident.decision === "block" ? "block" : "approve"); setDialogActor("ai"); setNotes(""); setDialogOpen(true); }}
                >
                  <Bot className="h-4 w-4" />
                  {t("cyberguard.decision.letAiDecide")}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => { setDialogAction("approve"); setDialogActor("human"); setNotes(""); setDialogOpen(true); }}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {t("cyberguard.decision.humanApprove")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setDialogAction("block"); setDialogActor("human"); setNotes(""); setDialogOpen(true); }}
                >
                  <ShieldOff className="h-4 w-4" />
                  {t("cyberguard.decision.humanBlock")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("cyberguard.detail.pipelineTitle")}
          </h2>
          <PipelineStepTracker status={incident.status} actions={actions} hasFileHash={!!incident.file_hash} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("cyberguard.detail.liveConsole")}
          </h2>
          <LiveConsoleLog rows={actions} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("cyberguard.detail.riskAssessment")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("cyberguard.detail.riskScore")}</p>
              <p className="text-lg font-semibold">{incident.risk_score}/100</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("cyberguard.detail.decision")}</p>
              <p className="text-lg font-semibold">{incident.decision ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("cyberguard.detail.status")}</p>
              <div className="text-lg font-semibold">
                <IncidentStatusBadge status={incident.status} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("cyberguard.detail.evidenceTitle")}
          </h2>
          <EvidencePanel evidence={evidence} />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("cyberguard.detail.timelineTitle")}
          </h2>
          <IncidentTimeline actions={actions} />
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogActor === "ai" ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
              {dialogAction === "approve"
                ? (dialogActor === "ai" ? t("cyberguard.decision.aiConfirmApprove") : t("cyberguard.decision.confirmApprove"))
                : (dialogActor === "ai" ? t("cyberguard.decision.aiConfirmBlock") : t("cyberguard.decision.confirmBlock"))}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? (dialogActor === "ai" ? t("cyberguard.decision.aiConfirmApproveDesc") : t("cyberguard.decision.confirmApproveDesc"))
                : (dialogActor === "ai" ? t("cyberguard.decision.aiConfirmBlockDesc") : t("cyberguard.decision.confirmBlockDesc"))}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p className="font-medium">{incident.title}</p>
            <p className="mt-1 text-muted-foreground">
              {incident.incident_number} · {incident.source_ip} ·
              {t("cyberguard.approvals.riskScore", { score: incident.risk_score })}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t("cyberguard.decision.notesLabel")}
            </label>
            <Textarea
              placeholder={dialogActor === "ai" ? t("cyberguard.decision.aiNotesPlaceholder") : t("cyberguard.decision.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isProcessing}>
              {t("cyberguard.decision.cancel")}
            </Button>
            <Button
              variant={dialogAction === "approve" ? "default" : "destructive"}
              className={dialogAction === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              onClick={handleDecision}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogActor === "ai" && <Bot className="mr-1 h-4 w-4" />}
              {dialogAction === "approve"
                ? t("cyberguard.decision.approve")
                : t("cyberguard.decision.block")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentDetail;
