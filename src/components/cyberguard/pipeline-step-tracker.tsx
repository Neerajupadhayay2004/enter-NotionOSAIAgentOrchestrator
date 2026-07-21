import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { IncidentAction, IncidentStatus } from "@/types/cyberguard";
import { Check, Loader2, Shield, Radar, Bug, Gavel, UserCheck, ShieldCheck } from "lucide-react";

interface Step {
  key: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  { key: "detect", labelKey: "cyberguard.pipeline.detect", icon: Shield },
  { key: "enrich", labelKey: "cyberguard.pipeline.enrich", icon: Radar },
  { key: "analyze", labelKey: "cyberguard.pipeline.analyze", icon: Bug },
  { key: "decide", labelKey: "cyberguard.pipeline.decide", icon: Gavel },
  { key: "approve", labelKey: "cyberguard.pipeline.approve", icon: UserCheck },
  { key: "resolve", labelKey: "cyberguard.pipeline.resolve", icon: ShieldCheck },
];

// Static class maps (Tailwind JIT cannot see dynamically constructed class names).
const DONE_CLASSES: Record<string, string> = {
  detect: "border-agent-threat-detection bg-agent-threat-detection text-primary-foreground",
  enrich: "border-agent-threat-detection bg-agent-threat-detection text-primary-foreground",
  analyze: "border-agent-malware-analysis bg-agent-malware-analysis text-primary-foreground",
  decide: "border-agent-incident-response bg-agent-incident-response text-primary-foreground",
  approve: "border-agent-human bg-agent-human text-primary-foreground",
  resolve: "border-agent-compliance bg-agent-compliance text-primary-foreground",
};
const ACTIVE_CLASSES: Record<string, string> = {
  detect: "border-agent-threat-detection text-agent-threat-detection",
  enrich: "border-agent-threat-detection text-agent-threat-detection",
  analyze: "border-agent-malware-analysis text-agent-malware-analysis",
  decide: "border-agent-incident-response text-agent-incident-response",
  approve: "border-agent-human text-agent-human",
  resolve: "border-agent-compliance text-agent-compliance",
};

function computeStepState(stepKey: string, status: IncidentStatus, actionTypes: Set<string>, hasFileHash: boolean): "done" | "active" | "pending" {
  const order = ["detect", "enrich", "analyze", "decide", "approve", "resolve"];
  const doneMap: Record<string, boolean> = {
    detect: actionTypes.has("detect"),
    enrich: actionTypes.has("enrich"),
    analyze: !hasFileHash || actionTypes.has("analyze"),
    decide: actionTypes.has("decide"),
    approve: status === "resolved" || status === "dismissed" || actionTypes.has("human_decision"),
    resolve: status === "resolved" || status === "dismissed",
  };

  if (doneMap[stepKey]) return "done";

  // Active = first not-done step in order, but only if we've at least started (detect exists)
  if (!actionTypes.has("detect")) return stepKey === "detect" ? "active" : "pending";

  const idx = order.indexOf(stepKey);
  for (let i = 0; i < idx; i++) {
    if (!doneMap[order[i]]) return "pending";
  }
  return "active";
}

export function PipelineStepTracker({ status, actions, hasFileHash }: { status: IncidentStatus; actions: IncidentAction[]; hasFileHash: boolean }) {
  const { t } = useTranslation();
  const actionTypes = new Set(actions.map((a) => a.action_type));
  // Skip "approve" step display if the incident never escalated (auto-resolved without human gate)
  const escalated = actionTypes.has("escalate") || status === "pending_approval";
  const visibleSteps = escalated ? STEPS : STEPS.filter((s) => s.key !== "approve");

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-3">
      {visibleSteps.map((step, index) => {
        const state = computeStepState(step.key, status, actionTypes, hasFileHash);
        const Icon = step.icon;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  state === "done" && DONE_CLASSES[step.key],
                  state === "active" && ACTIVE_CLASSES[step.key],
                  state === "pending" && "border-muted text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : state === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              </div>
              <span className={cn("text-[10px] font-medium", state === "pending" ? "text-muted-foreground" : "text-foreground")}>
                {t(step.labelKey)}
              </span>
            </div>
            {index < visibleSteps.length - 1 && (
              <div className={cn("h-0.5 w-6 sm:w-10", state === "done" ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
