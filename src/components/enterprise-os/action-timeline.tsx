import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ACTION_LABELS, ACTOR_LABELS, type AgentAction } from "@/types/enterprise-os";
import { Building2, Landmark, User, Bot } from "lucide-react";

const ACTOR_ICON: Record<AgentAction["actor"], React.ComponentType<{ className?: string }>> = {
  marketing: Building2,
  finance: Landmark,
  human: User,
  system: Bot,
};

const ACTOR_DOT: Record<AgentAction["actor"], string> = {
  marketing: "bg-actor-marketing",
  finance: "bg-actor-finance",
  human: "bg-actor-human",
  system: "bg-actor-system",
};

const ACTOR_TEXT: Record<AgentAction["actor"], string> = {
  marketing: "text-actor-marketing",
  finance: "text-actor-finance",
  human: "text-actor-human",
  system: "text-actor-system",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActionTimeline({ actions }: { actions: AgentAction[] }) {
  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No actions logged yet.
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
                    <span className={ACTOR_TEXT[action.actor]}>{ACTOR_LABELS[action.actor]}</span>{" "}
                    <span className="text-muted-foreground">{ACTION_LABELS[action.action_type]}</span>
                    {action.amount != null && (
                      <span className="font-semibold"> ${Number(action.amount).toLocaleString()}</span>
                    )}
                  </p>
                  <span className="text-xs text-muted-foreground">{formatTime(action.created_at)}</span>
                </div>
                {action.reasoning && (
                  <p className="mt-1.5 text-sm text-muted-foreground">{action.reasoning}</p>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
