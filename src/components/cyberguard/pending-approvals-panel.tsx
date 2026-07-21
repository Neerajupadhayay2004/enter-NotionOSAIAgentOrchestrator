import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SeverityBadge } from "@/components/cyberguard/severity-badge";
import type { SecurityIncident } from "@/types/cyberguard";
import { CheckCircle2, ExternalLink } from "lucide-react";

export function PendingApprovalsPanel({ incidents }: { incidents: SecurityIncident[] }) {
  const { t } = useTranslation();
  const pending = incidents.filter((i) => i.status === "pending_approval");

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
    <div className="space-y-3">
      {pending.map((incident) => (
        <Card key={incident.id} className="border-status-pending/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{incident.incident_number}</span>
                <p className="font-medium">{incident.title}</p>
                <SeverityBadge severity={incident.severity} />
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
                    {t("cyberguard.approvals.reviewInNotion")}
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/security/incidents/${incident.id}`}>{t("cyberguard.approvals.viewDetail")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
