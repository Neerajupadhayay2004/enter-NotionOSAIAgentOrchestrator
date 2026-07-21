import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ACTION_LABEL_KEYS, AGENT_LABEL_KEYS, type IncidentAction } from "@/types/cyberguard";
import { Shield, Bug, Siren, ClipboardCheck, User, Cog } from "lucide-react";

const ACTOR_ICON: Record<IncidentAction["actor"], React.ComponentType<{ className?: string }>> = {
  threat_detection: Shield,
  malware_analysis: Bug,
  incident_response: Siren,
  compliance: ClipboardCheck,
  human: User,
  system: Cog,
};

const ACTOR_DOT: Record<IncidentAction["actor"], string> = {
  threat_detection: "bg-agent-threat-detection",
  malware_analysis: "bg-agent-malware-analysis",
  incident_response: "bg-agent-incident-response",
  compliance: "bg-agent-compliance",
  human: "bg-agent-human",
  system: "bg-muted-foreground",
};

const ACTOR_TEXT: Record<IncidentAction["actor"], string> = {
  threat_detection: "text-agent-threat-detection",
  malware_analysis: "text-agent-malware-analysis",
  incident_response: "text-agent-incident-response",
  compliance: "text-agent-compliance",
  human: "text-agent-human",
  system: "text-muted-foreground",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function IncidentTimeline({ actions }: { actions: IncidentAction[] }) {
  const { t } = useTranslation();

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("cyberguard.timeline.empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <ol className="space-y-4">
      {actions.map((action, index) => {
        const Icon = ACTOR_ICON[action.actor];
        return (
          <li key={action.id} className="relative flex gap-4 pl-1">
            <div className="flex flex-col items-center">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-primary-foreground", ACTOR_DOT[action.actor])}>
                <Icon className="h-4 w-4" />
              </div>
              {index < actions.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <Card className="mb-2 flex-1">
              <CardContent className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium">
                    <span className={ACTOR_TEXT[action.actor]}>{t(AGENT_LABEL_KEYS[action.actor])}</span>{" "}
                    <span className="text-muted-foreground">{t(ACTION_LABEL_KEYS[action.action_type])}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">{formatTime(action.created_at)}</span>
                </div>
                {action.reasoning && <p className="mt-1.5 text-sm text-muted-foreground">{action.reasoning}</p>}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
