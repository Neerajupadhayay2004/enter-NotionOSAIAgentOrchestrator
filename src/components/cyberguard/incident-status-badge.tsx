import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { INCIDENT_STATUS_BADGE_VARIANT, INCIDENT_STATUS_LABEL_KEYS, type IncidentStatus } from "@/types/cyberguard";

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const { t } = useTranslation();
  return <Badge variant={INCIDENT_STATUS_BADGE_VARIANT[status]}>{t(INCIDENT_STATUS_LABEL_KEYS[status])}</Badge>;
}
