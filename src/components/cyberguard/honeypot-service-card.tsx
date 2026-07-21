import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Terminal, Server, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SERVICE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  ssh: Terminal,
  database: Database,
  rdp: Server,
};

const SERVICE_LABEL_KEY: Record<"ssh" | "database" | "rdp", string> = {
  ssh: "cyberguard.honeypot.service.ssh",
  database: "cyberguard.honeypot.service.database",
  rdp: "cyberguard.honeypot.service.rdp",
};

interface HoneypotServiceCardProps {
  service: "ssh" | "database" | "rdp";
  bannerLines: string[];
}

export function HoneypotServiceCard({ service, bannerLines }: HoneypotServiceCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isSimulating, setIsSimulating] = useState(false);
  const Icon = SERVICE_ICON[service];

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke("simulate-honeypot-attack", { body: { service } });
      if (error) throw error;
      toast.success(t("cyberguard.honeypot.toastAttackStarted", { incidentNumber: data.incidentNumber }));
      navigate(`/security/incidents/${data.incidentId}`);
    } catch (error) {
      console.error(error);
      toast.error(t("cyberguard.honeypot.toastAttackError"));
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b bg-muted/30 py-3">
        <Icon className="h-4 w-4 text-terminal-accent" />
        <span className="text-sm font-semibold">{t(SERVICE_LABEL_KEY[service])}</span>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="rounded-md bg-terminal-background p-3 font-mono text-xs leading-relaxed text-terminal-foreground">
          {bannerLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <span className="animate-pulse text-terminal-accent">_</span>
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={handleSimulate} disabled={isSimulating}>
          {isSimulating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("cyberguard.honeypot.simulateAttack")}
        </Button>
      </CardContent>
    </Card>
  );
}
