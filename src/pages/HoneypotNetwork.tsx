import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AppSwitcher } from "@/components/app-switcher";
import { HoneypotServiceCard } from "@/components/cyberguard/honeypot-service-card";
import { XssAttackForm } from "@/components/cyberguard/xss-attack-form";
import { VerdictBadge } from "@/components/cyberguard/verdict-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useHoneypotEvents } from "@/hooks/use-security-incidents";
import { HONEYPOT_SERVICE_LABEL_KEYS } from "@/types/cyberguard";
import { ArrowLeft, Loader2, Network } from "lucide-react";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" });
}

const HoneypotNetwork = () => {
  const { t } = useTranslation();
  const { events, isLoading } = useHoneypotEvents();

  return (
    <div className="min-h-full bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <div>
            <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {t("cyberguard.honeypot.backLink")}
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">{t("cyberguard.honeypot.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("cyberguard.honeypot.subtitle")}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <HoneypotServiceCard
            service="ssh"
            bannerLines={["SSH-2.0-OpenSSH_8.9p1 Ubuntu-3", "Warning: Unauthorized access is prohibited."]}
          />
          <XssAttackForm />
          <HoneypotServiceCard
            service="database"
            bannerLines={["MySQL [(none)]> connection established", "Server version: 8.0.34"]}
          />
          <HoneypotServiceCard
            service="rdp"
            bannerLines={["Remote Desktop Protocol :: Port 3389", "Negotiating security layer..."]}
          />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("cyberguard.honeypot.recentActivity")}
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {t("cyberguard.honeypot.noActivity")}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <Card key={event.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t(HONEYPOT_SERVICE_LABEL_KEYS[event.service])}</span>
                      <span className="font-mono text-xs text-muted-foreground">{event.source_ip}</span>
                      {event.payload && <span className="max-w-xs truncate font-mono text-xs text-muted-foreground">{event.payload}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <VerdictBadge verdict={event.verdict} />
                      <span className="text-xs text-muted-foreground">{formatTime(event.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HoneypotNetwork;
