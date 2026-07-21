import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AGENT_LABEL_KEYS, type AgentStatus } from "@/types/cyberguard";
import { Shield, Bug, Siren, ClipboardCheck } from "lucide-react";

const AGENT_ICON: Record<AgentStatus["agent_name"], React.ComponentType<{ className?: string }>> = {
  threat_detection: Shield,
  malware_analysis: Bug,
  incident_response: Siren,
  compliance: ClipboardCheck,
};

const AGENT_COLOR: Record<AgentStatus["agent_name"], string> = {
  threat_detection: "bg-agent-threat-detection",
  malware_analysis: "bg-agent-malware-analysis",
  incident_response: "bg-agent-incident-response",
  compliance: "bg-agent-compliance",
};

const AGENT_SUBTITLE_KEY: Record<AgentStatus["agent_name"], string> = {
  threat_detection: "cyberguard.agentCard.threatDetectionDesc",
  malware_analysis: "cyberguard.agentCard.malwareAnalysisDesc",
  incident_response: "cyberguard.agentCard.incidentResponseDesc",
  compliance: "cyberguard.agentCard.complianceDesc",
};

function formatRelativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return t("cyberguard.agentCard.justNow");
  if (seconds < 60) return t("cyberguard.agentCard.secondsAgo", { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("cyberguard.agentCard.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  return t("cyberguard.agentCard.hoursAgo", { count: hours });
}

export function AgentStatusCard({ agent }: { agent: AgentStatus }) {
  const { t } = useTranslation();
  const Icon = AGENT_ICON[agent.agent_name];
  const isWorking = agent.state === "working";

  return (
    <Card className={cn("transition-colors", isWorking && "border-primary/50")}>
      <CardContent className="flex items-start gap-3 py-4">
        <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-primary-foreground", AGENT_COLOR[agent.agent_name])}>
          <Icon className="h-5 w-5" />
          {isWorking && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t(AGENT_LABEL_KEYS[agent.agent_name])}</p>
          <p className="text-xs text-muted-foreground">{t(AGENT_SUBTITLE_KEY[agent.agent_name])}</p>
          <p className="mt-1 text-xs font-medium">
            {isWorking ? (
              <span className="text-primary">{t("cyberguard.agentCard.working")}</span>
            ) : (
              <span className="text-muted-foreground">{t("cyberguard.agentCard.idleSince", { time: formatRelativeTime(agent.last_active_at, t) })}</span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
