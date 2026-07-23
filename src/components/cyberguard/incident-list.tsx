import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { IncidentStatusBadge } from "@/components/cyberguard/incident-status-badge";
import { SeverityBadge } from "@/components/cyberguard/severity-badge";
import { CATEGORY_LABEL_KEYS, type SecurityIncident } from "@/types/cyberguard";
import { ArrowRight, ShieldOff, ShieldCheck, Trash2, Cpu, Bot, User, Loader2 } from "lucide-react";

export function IncidentList({ 
  incidents, 
  onApprove, 
  onBlock, 
  onDelete 
}: { 
  incidents: SecurityIncident[], 
  onApprove?: (incidentId: string, notes?: string, actor?: "human" | "ai" | "agent") => Promise<void>,
  onBlock?: (incidentId: string, notes?: string, actor?: "human" | "ai" | "agent") => Promise<void>,
  onDelete?: (incidentId: string, deletedBy?: string, notes?: string) => Promise<void>
}) {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<"approve" | "block" | "delete">("approve");
  const [dialogActor, setDialogActor] = useState<"human" | "ai" | "agent">("human");
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notes, setNotes] = useState("");

  const handleOpenDialog = (incident: SecurityIncident, action: "approve" | "block" | "delete") => {
    setSelectedIncident(incident);
    setDialogAction(action);
    setDialogActor("human");
    setNotes("");
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!selectedIncident) return;
    setIsProcessing(true);
    try {
      if (dialogAction === "approve" && onApprove) {
        await onApprove(selectedIncident.id, notes || undefined, dialogActor);
      } else if (dialogAction === "block" && onBlock) {
        await onBlock(selectedIncident.id, notes || undefined, dialogActor);
      } else if (dialogAction === "delete" && onDelete) {
        await onDelete(selectedIncident.id, dialogActor, notes || undefined);
      }
      setDialogOpen(false);
    } catch (err) {
      console.error("Error handling action:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (incidents.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <ShieldOff className="h-8 w-8" />
          <p>{t("cyberguard.incidentList.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {incidents.map((incident) => {
          const isPending = incident.status === "pending_approval" || incident.status === "detected" || incident.status === "analyzing";
          return (
            <Card key={incident.id} className="transition-colors hover:border-primary/50">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <Link to={`/security/incidents/${incident.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{incident.incident_number}</span>
                    <p className="truncate font-medium">{incident.title}</p>
                    <SeverityBadge severity={incident.severity} />
                    <IncidentStatusBadge status={incident.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(CATEGORY_LABEL_KEYS[incident.category])} · {incident.source_ip}
                    {incident.file_hash && <span className="font-mono"> · {incident.file_hash.slice(0, 12)}...</span>}
                  </p>
                </Link>
                {isPending && (onApprove || onBlock || onDelete) && (
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-purple-500 text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-950"
                      onClick={(e) => { e.preventDefault(); handleOpenDialog(incident, "approve"); setDialogActor("agent"); }}
                    >
                      <Cpu className="h-4 w-4 mr-1" /> Agent
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-950"
                      onClick={(e) => { e.preventDefault(); handleOpenDialog(incident, "approve"); setDialogActor("ai"); }}
                    >
                      <Bot className="h-4 w-4 mr-1" /> AI
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={(e) => { e.preventDefault(); handleOpenDialog(incident, "approve"); setDialogActor("human"); }}
                    >
                      <ShieldCheck className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={(e) => { e.preventDefault(); handleOpenDialog(incident, "block"); setDialogActor("human"); }}
                    >
                      <ShieldOff className="h-4 w-4 mr-1" /> Block
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                      onClick={(e) => { e.preventDefault(); handleOpenDialog(incident, "delete"); setDialogActor("human"); }}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                )}
                <Link to={`/security/incidents/${incident.id}`}>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
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
                ? "Are you sure you want to approve this incident?"
                : dialogAction === "block"
                ? "Are you sure you want to block this incident?"
                : "Are you sure you want to delete this incident?"}
            </DialogDescription>
          </DialogHeader>
          {selectedIncident && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <p className="font-medium">{selectedIncident.title}</p>
              <p className="mt-1 text-muted-foreground">
                {selectedIncident.incident_number} · {selectedIncident.source_ip} · Risk Score: {selectedIncident.risk_score}/100
              </p>
            </div>
          )}
          {dialogAction !== "delete" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium"> Notes (Optional)</label>
              <Textarea
                placeholder="Add notes..."
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
              {dialogAction === "approve" ? "Approve" : dialogAction === "block" ? "Block" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
