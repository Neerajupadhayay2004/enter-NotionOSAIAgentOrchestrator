import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SeverityBadge } from "@/components/cyberguard/severity-badge";
import { IncidentStatusBadge } from "@/components/cyberguard/incident-status-badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { IncidentAction, SecurityIncident } from "@/types/cyberguard";
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Bot,
  User,
  Cpu,
  Trash2,
} from "lucide-react";

interface PendingApprovalsPanelProps {
  incidents: SecurityIncident[];
  actions: IncidentAction[];
  onApprove: (incidentId: string, notes?: string, actor?: "human" | "ai" | "agent") => Promise<void>;
  onBlock: (incidentId: string, notes?: string, actor?: "human" | "ai" | "agent") => Promise<void>;
  onDelete?: (incidentId: string, deletedBy?: string, notes?: string) => Promise<void>;
}

export function PendingApprovalsPanel({
  incidents,
  actions,
  onApprove,
  onBlock,
  onDelete,
}: PendingApprovalsPanelProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const pending = incidents.filter((i) => i.status === "pending_approval");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "block" | "delete">("approve");
  const [dialogActor, setDialogActor] = useState<"human" | "ai" | "agent">("human");
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");

  const actionMap = useMemo(() => {
    const map: Record<string, IncidentAction[]> = {};
    for (const action of actions) {
      if (!map[action.incident_id]) map[action.incident_id] = [];
      map[action.incident_id].push(action);
    }
    return map;
  }, [actions]);

  const getAiReasoning = (incidentId: string): string | null => {
    const incidentActions = actionMap[incidentId] || [];
    const decideAction = incidentActions.find((a) => a.action_type === "decide");
    return decideAction?.reasoning || null;
  };

  const openDialog = (incident: SecurityIncident, action: "approve" | "block" | "delete", actor: "human" | "ai" | "agent") => {
    setSelectedIncident(incident);
    setDialogAction(action);
    setDialogActor(actor);
    setNotes("");
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedIncident) return;
    setIsProcessing(true);
    try {
      if (dialogAction === "approve") {
        await onApprove(selectedIncident.id, notes || undefined, dialogActor);
        toast({
          title: dialogActor === "ai" ? "AI Approved" : dialogActor === "agent" ? "Agent Approved" : "Approved",
          description: `Incident ${selectedIncident.incident_number} has been approved`,
        });
      } else if (dialogAction === "block") {
        await onBlock(selectedIncident.id, notes || undefined, dialogActor);
        toast({
          title: dialogActor === "ai" ? "AI Blocked" : dialogActor === "agent" ? "Agent Blocked" : "Blocked",
          description: `Incident ${selectedIncident.incident_number} from ${selectedIncident.source_ip} has been blocked`,
        });
      } else if (dialogAction === "delete" && onDelete) {
        await onDelete(selectedIncident.id, dialogActor, notes || undefined);
        toast({
          title: "Deleted",
          description: `Incident ${selectedIncident.incident_number} has been deleted`,
        });
      }
      setDialogOpen(false);
      setSelectedIncident(null);
    } catch {
      toast({
        title: "Error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (pending.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-8 w-8" />
          <p>{t("cyberguard.approvals.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {pending.map((incident) => {
          const aiReasoning = getAiReasoning(incident.id);
          const aiDecision = incident.decision;

          return (
            <Card key={incident.id} className="border-status-pending/40">
              <CardContent className="space-y-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{incident.incident_number}</span>
                      <p className="font-medium">{incident.title}</p>
                      <SeverityBadge severity={incident.severity} />
                      <IncidentStatusBadge status={incident.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("cyberguard.approvals.riskScore", { score: incident.risk_score })} · {incident.source_ip}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {incident.notion_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={incident.notion_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/security/incidents/${incident.id}`}>{t("cyberguard.approvals.viewDetail")}</Link>
                    </Button>
                  </div>
                </div>

                {aiReasoning && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                      <Bot className="h-4 w-4" />
                      {t("cyberguard.decision.aiRecommendation")}
                      {aiDecision && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold uppercase dark:bg-blue-900">
                          {aiDecision}
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
                    className="gap-1.5 border-purple-500 text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-950"
                    onClick={() => openDialog(incident, aiDecision === "block" ? "block" : "approve", "agent")}
                  >
                    <Cpu className="h-4 w-4" />
                    Let Agent Decide
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950"
                    onClick={() => openDialog(incident, aiDecision === "block" ? "block" : "approve", "ai")}
                  >
                    <Bot className="h-4 w-4" />
                    {t("cyberguard.decision.letAiDecide")}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => openDialog(incident, "approve", "human")}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {t("cyberguard.decision.humanApprove")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openDialog(incident, "block", "human")}
                  >
                    <ShieldOff className="h-4 w-4" />
                    {t("cyberguard.decision.humanBlock")}
                  </Button>
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                      onClick={() => openDialog(incident, "delete", "human")}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogActor === "ai" ? <Bot className="h-5 w-5" /> : dialogActor === "agent" ? <Cpu className="h-5 w-5" /> : <User className="h-5 w-5" />}
              {dialogAction === "approve"
                ? `${dialogActor === "ai" ? "AI" : dialogActor === "agent" ? "Agent" : "Human"} Approve Confirmation`
                : dialogAction === "block"
                ? `${dialogActor === "ai" ? "AI" : dialogActor === "agent" ? "Agent" : "Human"} Block Confirmation`
                : "Delete Confirmation"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "approve"
                ? "Are you sure you want to approve this incident? This will mark it as resolved."
                : dialogAction === "block"
                ? "Are you sure you want to block this incident? This will block the source IP."
                : "Are you sure you want to delete this incident? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {selectedIncident && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <p className="font-medium">{selectedIncident.title}</p>
              <p className="mt-1 text-muted-foreground">
                {selectedIncident.incident_number} · {selectedIncident.source_ip} ·
                Risk Score: {selectedIncident.risk_score}/100
              </p>
            </div>
          )}
          {dialogAction !== "delete" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Notes (Optional)
              </label>
              <Textarea
                placeholder={dialogActor === "ai" ? "Add reasoning for AI decision..." : dialogActor === "agent" ? "Add reasoning for agent decision..." : "Add notes for this decision..."}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              variant={dialogAction === "approve" ? "default" : "destructive"}
              className={dialogAction === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : ""}
              onClick={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dialogActor === "ai" && <Bot className="mr-1 h-4 w-4" />}
              {dialogActor === "agent" && <Cpu className="mr-1 h-4 w-4" />}
              {dialogAction === "approve"
                ? "Approve"
                : dialogAction === "block"
                ? "Block"
                : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
