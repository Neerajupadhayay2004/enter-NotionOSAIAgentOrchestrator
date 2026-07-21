import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { VerdictBadge } from "@/components/cyberguard/verdict-badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Monitor, ShieldAlert, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface AnalysisResult {
  verdict: "clean" | "suspicious" | "malicious";
  detectedPatterns: string[];
  explanation: string;
  llmProvider: "enter" | "groq";
  incidentId: string | null;
  incidentNumber: string | null;
}

export function XssAttackForm() {
  const { t } = useTranslation();
  const [payload, setPayload] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.trim()) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-xss-submission", {
        body: { payload, field: "comment" },
      });
      if (error) throw error;
      setResult(data);
      if (data.verdict !== "clean") {
        toast.success(t("cyberguard.honeypot.toastXssDetected"));
      } else {
        toast.info(t("cyberguard.honeypot.toastXssClean"));
      }
    } catch (error) {
      console.error(error);
      toast.error(t("cyberguard.honeypot.toastXssError"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b bg-muted/30 py-3">
        <Monitor className="h-4 w-4 text-terminal-accent" />
        <span className="text-sm font-semibold">{t("cyberguard.honeypot.service.adminPanel")}</span>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="rounded-md bg-terminal-background p-3 font-mono text-xs text-terminal-foreground">
          <div>{t("cyberguard.honeypot.adminPanelBanner1")}</div>
          <div>{t("cyberguard.honeypot.adminPanelBanner2")}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="xss-payload">{t("cyberguard.honeypot.commentLabel")}</Label>
            <Textarea
              id="xss-payload"
              placeholder={t("cyberguard.honeypot.commentPlaceholder")}
              rows={3}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <Button type="submit" size="sm" disabled={isAnalyzing} className="w-full">
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            {t("cyberguard.honeypot.submitComment")}
          </Button>
        </form>

        {result && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-muted-foreground">{t("cyberguard.honeypot.sandboxedPreview")}</span>
              <VerdictBadge verdict={result.verdict} />
            </div>
            {/* SAFETY: rendered as plain text content only -- never innerHTML/eval. This
                escapes the payload automatically via React, so no script can execute. */}
            <pre className="whitespace-pre-wrap break-all rounded bg-muted/50 p-2 text-xs">{payload}</pre>
            <p className="text-xs text-muted-foreground">{result.explanation}</p>
            {result.detectedPatterns.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("cyberguard.honeypot.patternsDetected")}: {result.detectedPatterns.join(", ")}
              </p>
            )}
            {result.incidentId && (
              <Link to={`/security/incidents/${result.incidentId}`} className="flex items-center gap-1 text-xs text-primary underline underline-offset-4">
                <LinkIcon className="h-3 w-3" />
                {t("cyberguard.honeypot.viewIncident", { incidentNumber: result.incidentNumber })}
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
