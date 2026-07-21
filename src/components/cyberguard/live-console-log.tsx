import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AGENT_LABEL_KEYS, ACTION_LABEL_KEYS, type IncidentAction } from "@/types/cyberguard";

type ConsoleRow = IncidentAction & { incident_number?: string };

const ACTOR_COLOR: Record<IncidentAction["actor"], string> = {
  threat_detection: "text-agent-threat-detection",
  malware_analysis: "text-agent-malware-analysis",
  incident_response: "text-agent-incident-response",
  compliance: "text-agent-compliance",
  human: "text-agent-human",
  system: "text-terminal-muted",
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 8);
}

export function LiveConsoleLog({ rows, maxHeight = "280px" }: { rows: ConsoleRow[]; maxHeight?: string }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rows.length]);

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto rounded-lg border border-terminal-accent/20 bg-terminal-background p-3 font-mono text-xs leading-relaxed"
      style={{ maxHeight }}
    >
      {rows.length === 0 ? (
        <p className="text-terminal-muted">{t("cyberguard.console.waiting")}</p>
      ) : (
        rows.map((row) => (
          <div key={row.id} className="flex gap-2 py-0.5">
            <span className="shrink-0 text-terminal-muted">[{formatTimestamp(row.created_at)}]</span>
            {row.incident_number && <span className="shrink-0 text-terminal-accent">{row.incident_number}</span>}
            <span className={`shrink-0 font-semibold ${ACTOR_COLOR[row.actor]}`}>{t(AGENT_LABEL_KEYS[row.actor])}</span>
            <span className="text-terminal-foreground">{t(ACTION_LABEL_KEYS[row.action_type])}</span>
            {row.reasoning && <span className="truncate text-terminal-muted">— {row.reasoning}</span>}
          </div>
        ))
      )}
      <div className="mt-1 flex items-center gap-1 text-terminal-accent">
        <span className="h-3 w-1.5 animate-pulse bg-terminal-accent" />
      </div>
    </div>
  );
}
