import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/enterprise-os/status-badge";
import type { BudgetRequest } from "@/types/enterprise-os";
import { ArrowRight, Inbox } from "lucide-react";

export function RequestList({ requests }: { requests: BudgetRequest[] }) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
          <Inbox className="h-8 w-8" />
          <p>No budget requests yet. Submit one to see the agents negotiate.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Link key={request.id} to={`/requests/${request.id}`}>
          <Card className="transition-colors hover:border-primary/50">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{request.campaign_name}</p>
                  <StatusBadge status={request.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {request.category} · Requested ${Number(request.requested_amount).toLocaleString()}
                  {request.final_amount != null && request.final_amount !== request.requested_amount && (
                    <> · Negotiated ${Number(request.final_amount).toLocaleString()}</>
                  )}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
