import { v } from "convex/values";
import { query } from "./_generated/server";

export const getSecurityIncidents = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("securityIncidents")
      .filter((q) => q.eq(q.field("isDeleted"), undefined))
      .order("desc")
      .collect();
  },
});

export const getSecurityIncidentById = query({
  args: { id: v.id("securityIncidents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getIncidentActions = query({
  args: { incidentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("incidentActions")
      .withIndex("by_incident", (q) => q.eq("incidentId", args.incidentId))
      .collect();
  },
});
