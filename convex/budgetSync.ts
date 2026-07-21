import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const upsert = mutation({
  args: {
    supabaseId: v.string(),
    campaignName: v.string(),
    category: v.string(),
    requestedAmount: v.number(),
    finalAmount: v.optional(v.number()),
    status: v.string(),
    justification: v.string(),
    requestedBy: v.string(),
    notionUrl: v.optional(v.string()),
    humanDecision: v.optional(v.string()),
    humanDecisionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("budgetRequests")
      .withIndex("by_supabase_id", (q) => q.eq("supabaseId", args.supabaseId))
      .unique();

    const data = {
      ...args,
      humanDecisionAt: args.humanDecision ? Date.now() : undefined,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("budgetRequests", data);
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("budgetRequests").collect();
    return all
      .filter((r) => r.status === "pending_approval")
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("budgetRequests").collect();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const recordDecision = mutation({
  args: {
    supabaseId: v.string(),
    status: v.string(),
    humanDecision: v.optional(v.string()),
    humanDecisionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("budgetRequests")
      .withIndex("by_supabase_id", (q) => q.eq("supabaseId", args.supabaseId))
      .unique();
    if (!existing) return null;
    await ctx.db.patch(existing._id, {
      status: args.status,
      humanDecision: args.humanDecision,
      humanDecisionNotes: args.humanDecisionNotes,
      humanDecisionAt: args.humanDecision ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all budget requests
    const requests = await ctx.db.query("budgetRequests").collect();
    for (const req of requests) {
      await ctx.db.delete(req._id);
    }
    // Delete all AI recommendations
    const recommendations = await ctx.db.query("aiRecommendations").collect();
    for (const rec of recommendations) {
      await ctx.db.delete(rec._id);
    }
    return { deleted: requests.length + recommendations.length };
  },
});

export const purgeStale = mutation({
  args: { maxAgeMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const maxAge = args.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days default
    const cutoff = Date.now() - maxAge;
    let deleted = 0;

    const requests = await ctx.db.query("budgetRequests").collect();
    for (const req of requests) {
      if (req.updatedAt < cutoff && (req.status === "completed" || req.status === "rejected")) {
        await ctx.db.delete(req._id);
        deleted++;
      }
    }

    const recommendations = await ctx.db.query("aiRecommendations").collect();
    for (const rec of recommendations) {
      if (rec.createdAt < cutoff) {
        await ctx.db.delete(rec._id);
        deleted++;
      }
    }

    return { deleted };
  },
});
