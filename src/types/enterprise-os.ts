import type { Database } from "@/integrations/supabase/types";

export type BudgetRequest = Database["public"]["Tables"]["budget_requests"]["Row"];
export type AgentAction = Database["public"]["Tables"]["agent_actions"]["Row"];

export type RequestStatus = BudgetRequest["status"];
export type ActionActor = AgentAction["actor"];
export type ActionType = AgentAction["action_type"];

export const STATUS_LABEL_KEYS: Record<RequestStatus, string> = {
  negotiating: "status.negotiating",
  pending_approval: "status.pendingApproval",
  approved: "status.approved",
  rejected: "status.rejected",
  completed: "status.approved",
};

export const STATUS_BADGE_VARIANT: Record<RequestStatus, "negotiating" | "pending" | "approved" | "rejected" | "completed"> = {
  negotiating: "negotiating",
  pending_approval: "pending",
  approved: "approved",
  rejected: "rejected",
  completed: "approved",
};

export const ACTOR_LABEL_KEYS: Record<ActionActor, string> = {
  marketing: "actor.marketing",
  finance: "actor.finance",
  human: "actor.human",
  system: "actor.system",
  ai: "actor.ai",
};

export const ACTION_LABEL_KEYS: Record<ActionType, string> = {
  propose: "action.propose",
  review: "action.review",
  counter: "action.counter",
  accept: "action.accept",
  escalate: "action.escalate",
  human_decision: "action.humanDecision",
  ai_decision: "action.aiDecision",
  notion_synced: "action.notionSynced",
  github_issue_created: "action.githubIssueCreated",
  error: "action.error",
  ai_review: "action.aiReview",
};
