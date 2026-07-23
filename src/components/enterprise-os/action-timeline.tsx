import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ACTION_LABEL_KEYS, ACTOR_LABEL_KEYS, type AgentAction } from "@/types/enterprise-os";
import { Building2, Landmark, User, Bot, Sparkles } from "lucide-react";

const ACTOR_ICON: Record<AgentAction["actor"], React.ComponentType<{ className?: string }>> = {
  marketing: Building2,
  finance: Landmark,
  human: User,
  system: Bot,
  ai: Sparkles,
};

const ACTOR_DOT: Record<AgentAction["actor"], string> = {
  marketing: "bg-purple-600 text-white",
  finance: "bg-sky-600 text-white",
  human: "bg-amber-600 text-white",
  system: "bg-slate-600 text-white",
  ai: "bg-violet-600 text-white",
};

const ACTOR_TEXT: Record<AgentAction["actor"], string> = {
  marketing: "text-purple-400 font-bold",
  finance: "text-sky-400 font-bold",
  human: "text-amber-400 font-bold",
  system: "text-slate-300 font-bold",
  ai: "text-violet-400 font-bold",
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
  const { t } = useTranslation();

  if (actions.length === 0) {
    return (
      <Card className="border-white/10 bg-slate-900/60">
        <CardContent className="py-8 text-center text-sm text-slate-400">
          {t("timeline.empty")}
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
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-md", ACTOR_DOT[action.actor])}>
                <Icon className="h-4 w-4" />
              </div>
              {index < actions.length - 1 && <div className="mt-1 w-px flex-1 bg-slate-800" />}
            </div>
            <Card className="mb-2 flex-1 border-white/10 bg-slate-900/90 text-slate-100 shadow-lg">
              <CardContent className="py-3 px-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium">
                    <span className={ACTOR_TEXT[action.actor]}>{t(ACTOR_LABEL_KEYS[action.actor])}</span>{" "}
                    <span className="text-slate-300 font-semibold">{t(ACTION_LABEL_KEYS[action.action_type])}</span>
                    {action.amount != null && (
                      <span className="font-extrabold text-emerald-400 ml-1"> ${Number(action.amount).toLocaleString()}</span>
                    )}
                  </p>
                  <span className="text-xs text-slate-400">{formatTime(action.created_at)}</span>
                </div>
                {action.reasoning && (
                  <p className="mt-2 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                    {action.reasoning}
                  </p>
                )}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
