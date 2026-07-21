import { useCallback, useEffect, useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { supabase } from "@/integrations/supabase/client";
import type { AgentAction, BudgetRequest } from "@/types/enterprise-os";

function convexToBudgetRequest(doc: Record<string, unknown>): BudgetRequest {
  return {
    id: (doc.supabaseId as string) ?? (doc._id as string) ?? "",
    campaign_name: (doc.campaignName as string) ?? "",
    category: (doc.category as string) ?? "",
    requested_amount: (doc.requestedAmount as number) ?? 0,
    final_amount: (doc.finalAmount as number) ?? null,
    status: (doc.status as string) ?? "negotiating",
    justification: (doc.justification as string) ?? "",
    requested_by: (doc.requestedBy as string) ?? "",
    notion_url: (doc.notionUrl as string) ?? null,
    notion_page_id: null,
    github_issue_url: null,
    created_at: new Date((doc.updatedAt as number) ?? Date.now()).toISOString(),
    updated_at: new Date((doc.updatedAt as number) ?? Date.now()).toISOString(),
  } as BudgetRequest;
}

export function useBudgetRequests() {
  const convexRequests = useQuery(api.budgetSync.listAll);
  const [supabaseRequests, setSupabaseRequests] = useState<BudgetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fallback to Supabase if Convex is unavailable
  useEffect(() => {
    if (convexRequests !== undefined) {
      setIsLoading(false);
      return;
    }
    // Convex not loaded yet, try Supabase
    let cancelled = false;
    supabase
      .from("budget_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!cancelled && !error && data) setSupabaseRequests(data);
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [convexRequests]);

  // Realtime from Supabase as backup
  useEffect(() => {
    if (convexRequests !== undefined) return; // Convex handles realtime
    const channel = supabase
      .channel("budget_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_requests" }, async () => {
        const { data } = await supabase
          .from("budget_requests")
          .select("*")
          .order("created_at", { ascending: false });
        if (data) setSupabaseRequests(data);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convexRequests]);

  const requests = useMemo(() => {
    if (convexRequests !== undefined) {
      return convexRequests.map(convexToBudgetRequest);
    }
    return supabaseRequests;
  }, [convexRequests, supabaseRequests]);

  return { requests, isLoading };
}

export function useBudgetRequest(requestId: string | undefined) {
  const [request, setRequest] = useState<BudgetRequest | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!requestId) return;
    const [{ data: requestData }, { data: actionsData }] = await Promise.all([
      supabase.from("budget_requests").select("*").eq("id", requestId).maybeSingle(),
      supabase.from("agent_actions").select("*").eq("request_id", requestId).order("created_at", { ascending: true }),
    ]);
    setRequest(requestData ?? null);
    setActions(actionsData ?? []);
    setIsLoading(false);
  }, [requestId]);

  useEffect(() => {
    refetch();
    if (!requestId) return;

    const channel = supabase
      .channel(`request_${requestId}_changes`)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_requests", filter: `id=eq.${requestId}` }, () => {
        refetch();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_actions", filter: `request_id=eq.${requestId}` }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [requestId, refetch]);

  return { request, actions, isLoading, refetch };
}
