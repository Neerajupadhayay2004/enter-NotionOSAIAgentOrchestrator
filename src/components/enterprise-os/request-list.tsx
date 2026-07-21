import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/enterprise-os/status-badge";
import { useBudgetNegotiation } from "@/hooks/use-budget-negotiation";
import type { BudgetRequest } from "@/types/enterprise-os";
import { ArrowRight, Inbox, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function RequestList({ requests, onRetryComplete }: { requests: BudgetRequest[]; onRetryComplete?: () => void }) {
  const { t } = useTranslation();
  const { negotiate, isNegotiating } = useBudgetNegotiation();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (requestId: string) => {
    setRetryingId(requestId);
    const result = await negotiate(requestId);
    setRetryingId(null);
    if (result.success) {
      toast.success(`AI decision: ${result.status}`);
    } else {
      toast.error("AI analysis failed, try again");
    }
    onRetryComplete?.();
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p>{t("home.requestsList.empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Link key={request.id} to={`/budget-os/requests/${request.id}`}>
          <Card className="transition-colors hover:border-primary/50">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{request.campaign_name}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("requestList.summary", {
                    category: request.category,
                    amount: Number(request.requested_amount).toLocaleString(),
                  })}
                  {request.final_amount != null && request.final_amount !== request.requested_amount && (
                    <>
                      {t("requestList.negotiatedSuffix", {
                        amount: Number(request.final_amount).toLocaleString(),
                      })}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {request.status === "negotiating" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRetry(request.id);
                    }}
                    disabled={retryingId === request.id}
                  >
                    <RefreshCw className={`h-4 w-4 ${retryingId === request.id ? "animate-spin" : ""}`} />
                  </Button>
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
