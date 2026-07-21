import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AgentAction, BudgetRequest } from "@/types/enterprise-os";

export function useBudgetRequests() {
  const [requests, setRequests] = useState<BudgetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("budget_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRequests(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();

    const channel = supabase
      .channel("budget_requests_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_requests" }, () => {
        refetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { requests, isLoading, refetch };
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
