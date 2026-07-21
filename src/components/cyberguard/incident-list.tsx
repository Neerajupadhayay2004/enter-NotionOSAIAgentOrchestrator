import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { IncidentStatusBadge } from "@/components/cyberguard/incident-status-badge";
import { SeverityBadge } from "@/components/cyberguard/severity-badge";
import { CATEGORY_LABEL_KEYS, type SecurityIncident } from "@/types/cyberguard";
import { ArrowRight, ShieldOff } from "lucide-react";

export function IncidentList({ incidents }: { incidents: SecurityIncident[] }) {
  const { t } = useTranslation();

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
    <div className="space-y-3">
      {incidents.map((incident) => (
        <Link key={incident.id} to={`/security/incidents/${incident.id}`}>
          <Card className="transition-colors hover:border-primary/50">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
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
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
