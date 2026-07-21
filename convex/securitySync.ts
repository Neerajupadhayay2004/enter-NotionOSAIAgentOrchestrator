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
    notionUrl: v.optional(v.string()),
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

    return await ctx.db.insert("securityIncidents", data);
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("securityIncidents").collect();
    return all
      .filter((r) => r.status === "pending_approval")
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("securityIncidents")
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
