import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AppSwitcher() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const current = location.pathname.startsWith("/budget-os") ? "budget-os" : "security";

  return (
    <Select value={current} onValueChange={(value) => navigate(value === "security" ? "/" : "/budget-os")}>
      <SelectTrigger className="w-[220px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="security">{t("appSwitcher.cyberguard")}</SelectItem>
        <SelectItem value="budget-os">{t("appSwitcher.budgetOs")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
