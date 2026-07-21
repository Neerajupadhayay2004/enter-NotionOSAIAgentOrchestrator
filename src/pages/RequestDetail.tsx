import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/enterprise-os/status-badge";
import { ActionTimeline } from "@/components/enterprise-os/action-timeline";
import { useBudgetRequest } from "@/hooks/use-budget-requests";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Github, Loader2, RefreshCw } from "lucide-react";

const RequestDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { request, actions, isLoading, refetch } = useBudgetRequest(id);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (!id) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("notion-sync-status", {
        body: { requestId: id },
      });
      if (error) throw error;
      if (data.synced) {
        toast.success(t("requestDetail.toastSynced"));
      } else {
        toast.info(t("requestDetail.toastNoDecision"));
      }
      refetch();
    } catch (error) {
      console.error(error);
      toast.error(t("requestDetail.toastSyncError"));
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12 text-center text-muted-foreground">
        {t("requestDetail.notFound")}
        <div className="mt-4">
          <Link to="/budget-os" className="text-sm text-primary underline underline-offset-4">{t("requestDetail.backToDashboard")}</Link>
        </div>
      </div>
    );
  }

  const showSyncButton = request.status === "pending_approval" || request.status === "approved";

  return (
    <div className="min-h-full bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <Link to="/budget-os" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("requestDetail.backLink")}
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{request.campaign_name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("requestDetail.requestedBy", { category: request.category, name: request.requested_by })}
              </p>
            </div>
            <StatusBadge status={request.status} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("requestDetail.outcome.title")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("requestDetail.outcome.requested")}</p>
              <p className="text-lg font-semibold">${Number(request.requested_amount).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("requestDetail.outcome.negotiated")}</p>
              <p className="text-lg font-semibold">
                {request.final_amount != null ? `$${Number(request.final_amount).toLocaleString()}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">{t("requestDetail.outcome.status")}</p>
              <div className="text-lg font-semibold">
                <StatusBadge status={request.status} />
              </div>
            </div>
          </CardContent>
          {(request.notion_url || request.github_issue_url || showSyncButton) && (
            <CardContent className="flex flex-wrap gap-2 border-t pt-4">
              {request.notion_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={request.notion_url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {t("requestDetail.viewInNotion")}
                  </a>
                </Button>
              )}
              {request.github_issue_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={request.github_issue_url} target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4" />
                    {t("requestDetail.viewGithubIssue")}
                  </a>
                </Button>
              )}
              {showSyncButton && (
                <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing}>
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {t("requestDetail.checkNotion")}
                </Button>
              )}
            </CardContent>
          )}
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("requestDetail.timelineTitle")}
          </h2>
          <ActionTimeline actions={actions} />
        </div>
      </main>
    </div>
  );
};

export default RequestDetail;
