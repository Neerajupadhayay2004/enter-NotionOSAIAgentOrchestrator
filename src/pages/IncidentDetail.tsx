import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IncidentStatusBadge } from "@/components/cyberguard/incident-status-badge";
import { SeverityBadge } from "@/components/cyberguard/severity-badge";
import { IncidentTimeline } from "@/components/cyberguard/incident-timeline";
import { EvidencePanel } from "@/components/cyberguard/evidence-card";
import { CATEGORY_LABEL_KEYS } from "@/types/cyberguard";
import { useIncidentDetail } from "@/hooks/use-security-incidents";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";

const IncidentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { incident, evidence, actions, isLoading, refetch } = useIncidentDetail(id);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!id) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("notion-sync-security-status", { body: { incidentId: id } });
      if (error) throw error;
      if (data.synced) toast.success(t("cyberguard.detail.toastSynced"));
      else toast.info(t("cyberguard.detail.toastNoDecision"));
      refetch();
    } catch (error) {
      console.error(error);
      toast.error(t("cyberguard.detail.toastSyncError"));
    } finally {
      setIsSyncing(false);
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

  const showSyncButton = incident.status === "pending_approval";

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
                <span className="font-mono text-sm text-muted-foreground">{incident.incident_number}</span>
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
          {(incident.notion_url || showSyncButton) && (
            <CardContent className="flex flex-wrap gap-2 border-t pt-4">
              {incident.notion_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={incident.notion_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t("cyberguard.detail.viewInNotion")}
                  </a>
                </Button>
              )}
              {showSyncButton && (
                <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing}>
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {t("cyberguard.detail.checkNotion")}
                </Button>
              )}
            </CardContent>
          )}
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
    </div>
  );
};

export default IncidentDetail;
