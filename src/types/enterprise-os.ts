import type { Database } from "@/integrations/supabase/types";

export type BudgetRequest = Database["public"]["Tables"]["budget_requests"]["Row"];
export type AgentAction = Database["public"]["Tables"]["agent_actions"]["Row"];

export type RequestStatus = BudgetRequest["status"];
export type ActionActor = AgentAction["actor"];
export type ActionType = AgentAction["action_type"];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  negotiating: "Negotiating",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
};

export const STATUS_BADGE_VARIANT: Record<RequestStatus, "negotiating" | "pending" | "approved" | "rejected" | "completed"> = {
  negotiating: "negotiating",
  pending_approval: "pending",
  approved: "approved",
  rejected: "rejected",
  completed: "completed",
};

export const ACTOR_LABELS: Record<ActionActor, string> = {
  marketing: "Marketing Agent",
  finance: "Finance Agent",
  human: "Human",
  system: "System",
};

export const ACTION_LABELS: Record<ActionType, string> = {
  propose: "proposed",
  review: "reviewed",
  counter: "countered with",
  accept: "accepted",
  escalate: "pushed back with",
  human_decision: "decided",
  notion_synced: "synced to Notion",
  github_issue_created: "opened a GitHub issue",
};
