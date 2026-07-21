import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AGENT_LABEL_KEYS, ACTION_LABEL_KEYS, type ActionActor, type IncidentAction } from "@/types/cyberguard";
import { Search } from "lucide-react";

type AuditRow = IncidentAction & { incident_number?: string; source_ip?: string };

const AGENT_FILTER_OPTIONS: ActionActor[] = ["threat_detection", "malware_analysis", "incident_response", "compliance", "human", "system"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export function AuditLogTable({ rows }: { rows: AuditRow[] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (agentFilter !== "all" && row.actor !== agentFilter) return false;
      if (!q) return true;
      const haystack = [
        row.incident_number, row.source_ip, row.reasoning,
        row.payload && typeof row.payload === "object" ? JSON.stringify(row.payload) : "",
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, query, agentFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("cyberguard.auditLog.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder={t("cyberguard.auditLog.filterByAgent")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("cyberguard.auditLog.allAgents")}</SelectItem>
            {AGENT_FILTER_OPTIONS.map((agent) => (
              <SelectItem key={agent} value={agent}>{t(AGENT_LABEL_KEYS[agent])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("cyberguard.auditLog.noResults")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t(AGENT_LABEL_KEYS[row.actor])}</Badge>
                  <span className="text-sm font-medium">{t(ACTION_LABEL_KEYS[row.action_type])}</span>
                  {row.incident_number && <span className="font-mono text-xs text-muted-foreground">{row.incident_number}</span>}
                  {row.source_ip && <span className="font-mono text-xs text-muted-foreground">{row.source_ip}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{formatTime(row.created_at)}</span>
                </div>
                {row.reasoning && <p className="text-sm text-muted-foreground">{row.reasoning}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
