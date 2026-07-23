import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AppSwitcher } from "@/components/app-switcher";
import { SocScene } from "@/components/cyberguard/soc-scene";
import { SystemStatsRow } from "@/components/cyberguard/system-stats-row";
import { IncidentList } from "@/components/cyberguard/incident-list";
import { PendingApprovalsPanel } from "@/components/cyberguard/pending-approvals-panel";
import { AgentStatusCard } from "@/components/cyberguard/agent-status-card";
import { AuditLogTable } from "@/components/cyberguard/audit-log-table";
import { SimulateAttackButton } from "@/components/cyberguard/simulate-attack-button";
import { LiveConsoleLog } from "@/components/cyberguard/live-console-log";
import { useSecurityIncidents, useAgentStatuses, useAllIncidentActions } from "@/hooks/use-security-incidents";
import { Loader2, ShieldHalf, Network } from "lucide-react";

const CyberGuardDashboard = () => {
  const { t } = useTranslation();
  const { incidents, isLoading, approveIncident, blockIncident } = useSecurityIncidents();
  const { agents } = useAgentStatuses();
  const { actions } = useAllIncidentActions();

  const sceneProps = useMemo(() => {
    const agentMap = Object.fromEntries(agents.map((a) => [a.agent_name, a.state]));
    return {
      detectionActive: agentMap.threat_detection === "working",
      malwareActive: agentMap.malware_analysis === "working",
      responseActive: agentMap.incident_response === "working",
      approvalPendingCount: incidents.filter((i) => i.status === "pending_approval").length,
      resolvedCount: incidents.filter((i) => i.status === "resolved").length,
    };
  }, [agents, incidents]);

  const pendingCount = incidents.filter((i) => i.status === "pending_approval").length;
  const blockedIps = incidents.filter((i) => i.status === "blocked" || i.decision === "block");

  return (
    <div className="min-h-full bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldHalf className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t("cyberguard.header.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("cyberguard.header.subtitle")}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SimulateAttackButton />
            <Button variant="outline" asChild>
              <Link to="/security/honeypot">
                <Network className="h-4 w-4" />
                {t("cyberguard.honeypot.navLink")}
              </Link>
            </Button>
            <AppSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="overview">{t("cyberguard.tabs.overview")}</TabsTrigger>
              <TabsTrigger value="incidents">{t("cyberguard.tabs.incidents")}</TabsTrigger>
              <TabsTrigger value="approvals">
                {t("cyberguard.tabs.approvals")}
                {pendingCount > 0 && <span className="ml-1.5 rounded-full bg-status-pending px-1.5 text-xs text-status-pending-foreground">{pendingCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="agents">{t("cyberguard.tabs.agents")}</TabsTrigger>
              <TabsTrigger value="audit">{t("cyberguard.tabs.audit")}</TabsTrigger>
              <TabsTrigger value="blocked">{t("cyberguard.tabs.blocked")}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <SystemStatsRow incidents={incidents} />
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("cyberguard.overview.socFloor")}
                </h2>
                <SocScene {...sceneProps} />
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("cyberguard.overview.liveFeed")}
                </h2>
                <LiveConsoleLog rows={actions.slice(0, 40)} maxHeight="220px" />
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("cyberguard.overview.recentIncidents")}
                </h2>
                <IncidentList incidents={incidents.slice(0, 5)} />
              </div>
            </TabsContent>

            <TabsContent value="incidents">
              <IncidentList incidents={incidents} />
            </TabsContent>

              <TabsContent value="approvals">
              <PendingApprovalsPanel incidents={incidents} actions={actions} onApprove={approveIncident} onBlock={blockIncident} />
            </TabsContent>

            <TabsContent value="agents" className="grid gap-3 sm:grid-cols-2">
              {agents.map((agent) => (
                <AgentStatusCard key={agent.agent_name} agent={agent} />
              ))}
            </TabsContent>

            <TabsContent value="audit">
              <AuditLogTable rows={actions} />
            </TabsContent>

            <TabsContent value="blocked">
              <IncidentList incidents={blockedIps} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default CyberGuardDashboard;
