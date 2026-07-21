import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

export function SimulateAttackButton() {
  const { t } = useTranslation();
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke("simulate-threat-event", { body: {} });
      if (error) throw error;
      toast.success(t("cyberguard.simulate.toastStarted", { incidentNumber: data.incidentNumber }));
    } catch (error) {
      console.error(error);
      toast.error(t("cyberguard.simulate.toastError"));
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <Button onClick={handleSimulate} disabled={isSimulating}>
      {isSimulating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("cyberguard.simulate.simulating")}
        </>
      ) : (
        <>
          <Zap className="h-4 w-4" />
          {t("cyberguard.simulate.button")}
        </>
      )}
    </Button>
  );
}
