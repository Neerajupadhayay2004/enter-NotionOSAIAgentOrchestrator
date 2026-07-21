import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export function NewRequestForm() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const CATEGORIES = [
    { value: "Paid Ads", labelKey: "home.form.categoryPaidAds" },
    { value: "Events", labelKey: "home.form.categoryEvents" },
    { value: "Content & Creative", labelKey: "home.form.categoryContent" },
    { value: "Tools & Software", labelKey: "home.form.categoryTools" },
    { value: "Sponsorships", labelKey: "home.form.categorySponsorships" },
  ];
  const [campaignName, setCampaignName] = useState("");
  const [category, setCategory] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName || !category || !requestedAmount || !justification) {
      toast.error(t("home.form.toastMissingFields"));
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-budget-request", {
        body: {
          campaignName,
          category,
          requestedAmount: Number(requestedAmount),
          justification,
        },
      });

      if (error) throw error;

      toast.success(t("home.form.toastSubmitted"));
      navigate(`/budget-os/requests/${data.requestId}`);
    } catch (error) {
      console.error(error);
      toast.error(t("home.form.toastError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-actor-marketing" />
          {t("home.form.title")}
        </CardTitle>
        <CardDescription>
          {t("home.form.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campaignName">{t("home.form.campaignNameLabel")}</Label>
            <Input
              id="campaignName"
              placeholder={t("home.form.campaignNamePlaceholder")}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">{t("home.form.categoryLabel")}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder={t("home.form.categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{t(c.labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestedAmount">{t("home.form.amountLabel")}</Label>
              <Input
                id="requestedAmount"
                type="number"
                min="0"
                placeholder={t("home.form.amountPlaceholder")}
                value={requestedAmount}
                onChange={(e) => setRequestedAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="justification">{t("home.form.justificationLabel")}</Label>
            <Textarea
              id="justification"
              placeholder={t("home.form.justificationPlaceholder")}
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("home.form.submitting")}
              </>
            ) : (
              t("home.form.submitButton")
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
