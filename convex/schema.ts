import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  budgetRequests: defineTable({
    supabaseId: v.optional(v.string()),
    campaignName: v.string(),
    category: v.string(),
    requestedAmount: v.number(),
    finalAmount: v.optional(v.number()),
    status: v.string(),
    justification: v.string(),
    requestedBy: v.string(),
    marketAnalysisData: v.optional(v.string()),
    marketAnalysisScore: v.optional(v.number()),
    humanDecision: v.optional(v.string()),
    humanDecisionNotes: v.optional(v.string()),
    humanDecisionAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_supabase_id", ["supabaseId"])
    .index("by_status", ["status"]),

  aiRecommendations: defineTable({
    requestSupabaseId: v.string(),
    recommendation: v.union(
      v.literal("approve"),
      v.literal("reject"),
      v.literal("negotiate"),
    ),
    confidence: v.number(),
    reasoning: v.string(),
    riskFactors: v.array(v.string()),
    strengths: v.array(v.string()),
    provider: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_request", ["requestSupabaseId"]),

  securityIncidents: defineTable({
    supabaseId: v.optional(v.string()),
    incidentNumber: v.string(),
    title: v.string(),
    category: v.string(),
    sourceIp: v.string(),
    fileHash: v.optional(v.string()),
    status: v.string(),
    severity: v.optional(v.string()),
    riskScore: v.optional(v.number()),
    decision: v.optional(v.string()),
    agentDecision: v.optional(v.string()),
    agentDecisionReasoning: v.optional(v.string()),
    agentDecisionAt: v.optional(v.number()),
    agentConfidence: v.optional(v.number()),
    humanDecision: v.optional(v.string()),
    humanDecisionNotes: v.optional(v.string()),
    humanDecisionAt: v.optional(v.number()),
    aiDecision: v.optional(v.string()),
    aiDecisionReasoning: v.optional(v.string()),
    aiDecisionAt: v.optional(v.number()),
    aiProvider: v.optional(v.string()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
    notionPageId: v.optional(v.string()),
    notionUrl: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_supabase_id", ["supabaseId"])
    .index("by_status", ["status"])
    .index("by_is_deleted", ["isDeleted"]),

  incidentAnalyses: defineTable({
    incidentSupabaseId: v.string(),
    severity: v.string(),
    riskScore: v.number(),
    decision: v.string(),
    reasoning: v.string(),
    provider: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_incident", ["incidentSupabaseId"]),

  incidentActions: defineTable({
    incidentId: v.string(),
    actor: v.string(),
    actionType: v.string(),
    reasoning: v.optional(v.string()),
    payload: v.optional(v.string()),
    searchText: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_incident", ["incidentId"]),
});
