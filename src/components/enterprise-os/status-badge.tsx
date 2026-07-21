import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_VARIANT, STATUS_LABEL_KEYS, type RequestStatus } from "@/types/enterprise-os";

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{t(STATUS_LABEL_KEYS[status])}</Badge>;
}
