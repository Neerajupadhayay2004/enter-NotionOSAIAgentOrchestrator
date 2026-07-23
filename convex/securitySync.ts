import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const upsert = mutation({
  args: {
    supabaseId: v.string(),
    incidentNumber: v.string(),
    title: v.string(),
    category: v.string(),
    sourceIp: v.string(),
    fileHash: v.optional(v.string()),
    status: v.string(),
    severity: v.optional(v.string()),
    riskScore: v.optional(v.number()),
    decision: v.optional(v.string()),
    notionPageId: v.optional(v.string()),
    notionUrl: v.optional(v.string()),
    humanDecision: v.optional(v.string()),
    humanDecisionNotes: v.optional(v.string()),
    humanDecisionAt: v.optional(v.number()),
    aiDecision: v.optional(v.string()),
    aiDecisionReasoning: v.optional(v.string()),
    aiDecisionAt: v.optional(v.number()),
    aiProvider: v.optional(v.string()),
    agentDecision: v.optional(v.string()),
    agentDecisionReasoning: v.optional(v.string()),
    agentDecisionAt: v.optional(v.number()),
    agentConfidence: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    deletedAt: v.optional(v.number()),
    deletedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("securityIncidents")
      .withIndex("by_supabase_id", (q) => q.eq("supabaseId", args.supabaseId))
      .unique();

    const data = { ...args, updatedAt: Date.now() };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("securityIncidents", {
      ...data,
      createdAt: Date.now(),
    });
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("securityIncidents").collect();
    return all
      .filter((r) => r.status === "pending_approval" && !r.isDeleted)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("securityIncidents")
      .filter((q) => q.eq(q.field("isDeleted"), undefined))
      .order("desc")
      .collect();
  },
});

export const saveAnalysis = mutation({
  args: {
    incidentSupabaseId: v.string(),
    severity: v.string(),
    riskScore: v.number(),
    decision: v.string(),
    reasoning: v.string(),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("incidentAnalyses", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getLatestAnalysis = query({
  args: { incidentSupabaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("incidentAnalyses")
      .withIndex("by_incident", (q) => q.eq("incidentSupabaseId", args.incidentSupabaseId))
      .order("desc")
      .first();
  },
});

export const getIncidentById = query({
  args: { id: v.id("securityIncidents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getActionsByIncidentId = query({
  args: { incidentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("incidentActions")
      .withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId))
      .collect();
  },
});
