import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { NewRequestForm } from "@/components/enterprise-os/new-request-form";
import { RequestList } from "@/components/enterprise-os/request-list";
import { OfficeScene } from "@/components/enterprise-os/office-scene";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useBudgetRequests } from "@/hooks/use-budget-requests";
import { Loader2, Building2 } from "lucide-react";

const Index = () => {
  const { t } = useTranslation();
  const { requests, isLoading } = useBudgetRequests();

  const counts = useMemo(() => ({
    negotiatingCount: requests.filter((r) => r.status === "negotiating").length,
    pendingCount: requests.filter((r) => r.status === "pending_approval").length,
    approvedCount: requests.filter((r) => r.status === "approved" || r.status === "completed").length,
    rejectedCount: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  return (
    <div className="min-h-full bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">{t("home.header.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("home.header.subtitle")}</p>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("home.office.title")}
          </h2>
          <OfficeScene {...counts} />
        </div>

        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
          <div>
            <NewRequestForm />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("home.requestsList.title")}
            </h2>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RequestList requests={requests} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
