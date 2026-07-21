import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "@/components/cyberguard/verdict-badge";
import { EVIDENCE_SOURCE_LABEL_KEYS, type IncidentEvidence } from "@/types/cyberguard";
import { ChevronDown, ChevronRight, Radar, ShieldAlert, Bug, Globe2 } from "lucide-react";

const SOURCE_ICON: Record<IncidentEvidence["source"], React.ComponentType<{ className?: string }>> = {
  shodan: Radar,
  abuseipdb: ShieldAlert,
  virustotal: Bug,
  alienvault_otx: Globe2,
};

export function EvidenceCardView({ evidence }: { evidence: IncidentEvidence }) {
  const { t } = useTranslation();
  const [showRaw, setShowRaw] = useState(false);
  const Icon = SOURCE_ICON[evidence.source];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t(EVIDENCE_SOURCE_LABEL_KEYS[evidence.source])}</span>
        </div>
        <VerdictBadge verdict={evidence.verdict} />
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Number(evidence.score))}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{Math.round(Number(evidence.score))}/100</span>
        </div>
        <p className="text-sm text-muted-foreground">{evidence.summary}</p>
        {evidence.raw_response != null && (
          <div>
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showRaw ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {t("cyberguard.evidence.viewRaw")}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-md border bg-muted/50 p-2 text-[10px] leading-relaxed">
                {JSON.stringify(evidence.raw_response, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EvidencePanel({ evidence, onRecheck, isRechecking }: { evidence: IncidentEvidence[]; onRecheck?: () => void; isRechecking?: boolean }) {
  const { t } = useTranslation();

  if (evidence.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("cyberguard.evidence.empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {onRecheck && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onRecheck} disabled={isRechecking}>
            {isRechecking ? t("cyberguard.evidence.rechecking") : t("cyberguard.evidence.recheck")}
          </Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {evidence.map((card) => (
          <EvidenceCardView key={card.id} evidence={card} />
        ))}
      </div>
    </div>
  );
}
