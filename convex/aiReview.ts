import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getLatest = query({
  args: { requestSupabaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiRecommendations")
      .withIndex("by_request", (q) => q.eq("requestSupabaseId", args.requestSupabaseId))
      .order("desc")
      .first();
  },
});

export const save = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiRecommendations", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listByRequest = query({
  args: { requestSupabaseId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiRecommendations")
      .withIndex("by_request", (q) => q.eq("requestSupabaseId", args.requestSupabaseId))
      .order("desc")
      .collect();
  },
});
