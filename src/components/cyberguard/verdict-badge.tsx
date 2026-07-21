import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { VERDICT_BADGE_VARIANT, VERDICT_LABEL_KEYS, type EvidenceVerdict } from "@/types/cyberguard";

export function VerdictBadge({ verdict }: { verdict: EvidenceVerdict }) {
  const { t } = useTranslation();
  return <Badge variant={VERDICT_BADGE_VARIANT[verdict]}>{t(VERDICT_LABEL_KEYS[verdict])}</Badge>;
}
