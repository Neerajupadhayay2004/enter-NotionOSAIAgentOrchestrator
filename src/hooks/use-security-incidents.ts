import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AgentStatus, HoneypotEvent, IncidentAction, IncidentEvidence, SecurityIncident } from "@/types/cyberguard";

export function useSecurityIncidents() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("security_incidents")
        .select("*")
        .order("created_at", { ascending: false });
      if (!error && data) setIncidents(data);
    } catch (e) {
      console.error("Error fetching incidents:", e);
    }
    setIsLoading(false);
  }, []);

  const approveIncident = useCallback(async (incidentId: string, notes?: string, actor: "human" | "ai" | "agent" = "human") => {
    const now = new Date().toISOString();
    // Update local state first for immediate feedback
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId 
        ? { ...incident, status: "resolved", decision: "monitor", updated_at: now } 
        : incident
    ));

    // Try to sync with Supabase in background, ignore errors
    (async () => {
      try {
        const updateData: any = {
          status: "resolved",
          decision: "monitor",
          updated_at: now,
        };
        await supabase
          .from("security_incidents")
          .update(updateData)
          .eq("id", incidentId);

        const dbActor = actor === "human" ? "human" : "incident_response";
        const defaultReasoning = actor === "ai" ? "AI auto-approved the incident based on analysis." : 
                                actor === "agent" ? "Agent approved the incident automatically." : "Human approved the incident.";
        const actionData: any = {
          incident_id: incidentId,
          actor: dbActor,
          action_type: "human_decision",
          reasoning: notes || defaultReasoning,
          payload: {
            decision: "approve",
            originalActor: actor,
            notes: notes
          }
        };
        await supabase
          .from("incident_actions")
          .insert(actionData);
      } catch (e) {
        console.error("Supabase sync error (approve):", e);
      }
    })();
  }, []);

  const blockIncident = useCallback(async (incidentId: string, notes?: string, actor: "human" | "ai" | "agent" = "human") => {
    const now = new Date().toISOString();
    // Update local state first for immediate feedback
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId 
        ? { ...incident, status: "resolved", decision: "block", updated_at: now } 
        : incident
    ));

    // Try to sync with Supabase in background, ignore errors
    (async () => {
      try {
        const updateData: any = {
          status: "resolved",
          decision: "block",
          updated_at: now,
        };
        await supabase
          .from("security_incidents")
          .update(updateData)
          .eq("id", incidentId);

        const dbActor = actor === "human" ? "human" : "incident_response";
        const defaultReasoning = actor === "ai" ? "AI auto-blocked the incident based on analysis." : 
                                actor === "agent" ? "Agent blocked the incident automatically." : "Human blocked the incident.";
        const actionData: any = {
          incident_id: incidentId,
          actor: dbActor,
          action_type: "human_decision",
          reasoning: notes || defaultReasoning,
          payload: {
            decision: "block",
            originalActor: actor,
            notes: notes
          }
        };
        await supabase
          .from("incident_actions")
          .insert(actionData);
      } catch (e) {
        console.error("Supabase sync error (block):", e);
      }
    })();
  }, []);

  const deleteIncident = useCallback(async (incidentId: string, deletedBy: string = "human", notes?: string) => {
    const now = new Date().toISOString();
    // Update local state first for immediate feedback
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId 
        ? { ...incident, status: "dismissed", updated_at: now } 
        : incident
    ));

    // Try to sync with Supabase in background, ignore errors
    (async () => {
      try {
        const updateData: any = {
          status: "dismissed",
          updated_at: now,
        };
        await supabase
          .from("security_incidents")
          .update(updateData)
          .eq("id", incidentId);

        const actionData: any = {
          incident_id: incidentId,
          actor: "human",
          action_type: "human_decision",
          reasoning: notes || "Incident deleted",
          payload: {
            decision: "delete",
            deletedBy: deletedBy,
            notes: notes
          }
        };
        await supabase
          .from("incident_actions")
          .insert(actionData);
      } catch (e) {
        console.error("Supabase sync error (delete):", e);
      }
    })();
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel("security_incidents_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "security_incidents" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { incidents, isLoading, refetch, approveIncident, blockIncident, deleteIncident };
}

export function useIncidentDetail(incidentId: string | undefined) {
  const [incident, setIncident] = useState<SecurityIncident | null>(null);
  const [evidence, setEvidence] = useState<IncidentEvidence[]>([]);
  const [actions, setActions] = useState<IncidentAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Function to update incident locally
  const updateLocalIncident = useCallback((updated: Partial<SecurityIncident>) => {
    setIncident(prev => prev ? { ...prev, ...updated } : null);
  }, []);

  const refetch = useCallback(async () => {
    if (!incidentId) return;
    try {
      const [{ data: incidentData }, { data: evidenceData }, { data: actionsData }] = await Promise.all([
        supabase.from("security_incidents").select("*").eq("id", incidentId).maybeSingle(),
        supabase.from("incident_evidence").select("*").eq("incident_id", incidentId).order("created_at", { ascending: true }),
        supabase.from("incident_actions").select("*").eq("incident_id", incidentId).order("created_at", { ascending: true }),
      ]);
      setIncident(incidentData ?? null);
      setEvidence(evidenceData ?? []);
      setActions(actionsData ?? []);
    } catch (e) {
      console.error("Error fetching incident detail:", e);
    }
    setIsLoading(false);
  }, [incidentId]);

  useEffect(() => {
    refetch();
    if (!incidentId) return;
    const channel = supabase
      .channel(`incident_${incidentId}_changes`)
      .on("postgres_changes", { event: "*", schema: "public", table: "security_incidents", filter: `id=eq.${incidentId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_evidence", filter: `incident_id=eq.${incidentId}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_actions", filter: `incident_id=eq.${incidentId}` }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidentId, refetch]);

  return { incident, evidence, actions, isLoading, refetch, updateLocalIncident };
}

export function useAgentStatuses() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from("agent_status").select("*").order("agent_name", { ascending: true });
    if (!error && data) setAgents(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel("agent_status_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_status" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { agents, isLoading };
}

export function useAllIncidentActions() {
  const [actions, setActions] = useState<(IncidentAction & { incident_number?: string; source_ip?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("incident_actions")
      .select("*, security_incidents(incident_number, source_ip)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (!error && data) {
      setActions(data.map((row) => {
        const joined = row as typeof row & { security_incidents?: { incident_number: string; source_ip: string } | null };
        return {
          ...joined,
          incident_number: joined.security_incidents?.incident_number,
          source_ip: joined.security_incidents?.source_ip,
        };
      }));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel("all_incident_actions_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_actions" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { actions, isLoading };
}

export function useHoneypotEvents() {
  const [events, setEvents] = useState<HoneypotEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from("honeypot_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) setEvents(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel("honeypot_events_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "honeypot_events" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { events, isLoading };
}
