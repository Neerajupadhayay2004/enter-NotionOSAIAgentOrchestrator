import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import type { SecurityIncident } from "@/types/cyberguard";
import { Activity, ShieldAlert, ShieldCheck, Siren } from "lucide-react";

export function SystemStatsRow({ incidents }: { incidents: SecurityIncident[] }) {
  const { t } = useTranslation();

  const active = incidents.filter((i) => i.status === "analyzing" || i.status === "detected" || i.status === "pending_approval").length;
  const pendingApproval = incidents.filter((i) => i.status === "pending_approval").length;
  const blocked = incidents.filter((i) => i.decision === "block").length;
  const avgRisk = incidents.length > 0
    ? Math.round(incidents.reduce((sum, i) => sum + Number(i.risk_score), 0) / incidents.length)
    : 0;

  const stats = [
    { icon: Activity, label: t("cyberguard.stats.activeIncidents"), value: active, color: "text-agent-threat-detection" },
    { icon: Siren, label: t("cyberguard.stats.pendingApproval"), value: pendingApproval, color: "text-status-pending" },
    { icon: ShieldAlert, label: t("cyberguard.stats.blockedIps"), value: blocked, color: "text-severity-critical" },
    { icon: ShieldCheck, label: t("cyberguard.stats.avgRiskScore"), value: `${avgRisk}/100`, color: "text-agent-compliance" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-3 py-4">
            <stat.icon className={`h-6 w-6 shrink-0 ${stat.color}`} />
            <div>
              <p className="text-lg font-semibold leading-none">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
