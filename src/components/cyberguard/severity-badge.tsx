import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { SEVERITY_BADGE_VARIANT, SEVERITY_LABEL_KEYS, type IncidentSeverity } from "@/types/cyberguard";

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const { t } = useTranslation();
  return <Badge variant={SEVERITY_BADGE_VARIANT[severity]}>{t(SEVERITY_LABEL_KEYS[severity])}</Badge>;
}
