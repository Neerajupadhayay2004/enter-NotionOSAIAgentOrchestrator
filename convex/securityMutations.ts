import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const approveIncident = mutation({
  args: {
    incidentId: v.id("securityIncidents"),
    actor: v.union(v.literal("human"), v.literal("ai"), v.literal("agent")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    const updateData: any = {
      status: "resolved",
      decision: "approve",
      updatedAt: now,
    };

    if (args.actor === "human") {
      updateData.humanDecision = "approve";
      updateData.humanDecisionNotes = args.notes;
      updateData.humanDecisionAt = now;
    } else if (args.actor === "ai") {
      updateData.aiDecision = "approve";
      updateData.aiDecisionReasoning = args.notes;
      updateData.aiDecisionAt = now;
      updateData.aiProvider = "gemini";
    } else if (args.actor === "agent") {
      updateData.agentDecision = "approve";
      updateData.agentDecisionReasoning = args.notes;
      updateData.agentDecisionAt = now;
      updateData.agentConfidence = 0.95;
    }

    await ctx.db.patch(args.incidentId, updateData);

    await ctx.db.insert("incidentActions", {
      incidentId: args.incidentId,
      actor: args.actor,
      actionType: args.actor === "ai" ? "ai_approval" : args.actor === "agent" ? "agent_approval" : "human_approval",
      reasoning: args.notes || `${args.actor} approved the incident`,
      createdAt: now,
    });

    return { success: true };
  },
});

export const blockIncident = mutation({
  args: {
    incidentId: v.id("securityIncidents"),
    actor: v.union(v.literal("human"), v.literal("ai"), v.literal("agent")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    const updateData: any = {
      status: "blocked",
      decision: "block",
      updatedAt: now,
    };

    if (args.actor === "human") {
      updateData.humanDecision = "block";
      updateData.humanDecisionNotes = args.notes;
      updateData.humanDecisionAt = now;
    } else if (args.actor === "ai") {
      updateData.aiDecision = "block";
      updateData.aiDecisionReasoning = args.notes;
      updateData.aiDecisionAt = now;
      updateData.aiProvider = "gemini";
    } else if (args.actor === "agent") {
      updateData.agentDecision = "block";
      updateData.agentDecisionReasoning = args.notes;
      updateData.agentDecisionAt = now;
      updateData.agentConfidence = 0.95;
    }

    await ctx.db.patch(args.incidentId, updateData);

    await ctx.db.insert("incidentActions", {
      incidentId: args.incidentId,
      actor: args.actor,
      actionType: args.actor === "ai" ? "ai_block" : args.actor === "agent" ? "agent_block" : "human_block",
      reasoning: args.notes || `${args.actor} blocked the incident`,
      createdAt: now,
    });

    return { success: true };
  },
});

export const deleteIncident = mutation({
  args: {
    incidentId: v.id("securityIncidents"),
    deletedBy: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incident = await ctx.db.get(args.incidentId);
    if (!incident) {
      throw new Error("Incident not found");
    }

    await ctx.db.patch(args.incidentId, {
      isDeleted: true,
      deletedAt: now,
      deletedBy: args.deletedBy,
      status: "dismissed",
      updatedAt: now,
    });

    await ctx.db.insert("incidentActions", {
      incidentId: args.incidentId,
      actor: args.deletedBy,
      actionType: "delete",
      reasoning: args.notes || "Incident deleted",
      createdAt: now,
    });

    return { success: true };
  },
});

export const createIncident = mutation({
  args: {
    incidentNumber: v.string(),
    title: v.string(),
    category: v.string(),
    sourceIp: v.string(),
    fileHash: v.optional(v.string()),
    severity: v.optional(v.string()),
    riskScore: v.optional(v.number()),
    supabaseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incidentId = await ctx.db.insert("securityIncidents", {
      incidentNumber: args.incidentNumber,
      title: args.title,
      category: args.category,
      sourceIp: args.sourceIp,
      fileHash: args.fileHash,
      status: "detected",
      severity: args.severity || "medium",
      riskScore: args.riskScore || 50,
      supabaseId: args.supabaseId,
      updatedAt: now,
    });

    await ctx.db.insert("incidentActions", {
      incidentId: incidentId,
      actor: "system",
      actionType: "detect",
      reasoning: "Incident detected by security system",
      createdAt: now,
    });

    return { incidentId };
  },
});

export const updateIncidentFromSupabase = mutation({
  args: {
    supabaseId: v.string(),
    status: v.optional(v.string()),
    decision: v.optional(v.string()),
    humanDecision: v.optional(v.string()),
    humanDecisionNotes: v.optional(v.string()),
    humanDecisionAt: v.optional(v.number()),
    notionPageId: v.optional(v.string()),
    notionUrl: v.optional(v.string()),
    severity: v.optional(v.string()),
    riskScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const incidents = await ctx.db
      .query("securityIncidents")
      .withIndex("by_supabase_id", (q) => q.eq("supabaseId", args.supabaseId))
      .collect();

    if (incidents.length === 0) {
      return { success: false, error: "Incident not found" };
    }

    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.status !== undefined) updateData.status = args.status;
    if (args.decision !== undefined) updateData.decision = args.decision;
    if (args.humanDecision !== undefined) updateData.humanDecision = args.humanDecision;
    if (args.humanDecisionNotes !== undefined) updateData.humanDecisionNotes = args.humanDecisionNotes;
    if (args.humanDecisionAt !== undefined) updateData.humanDecisionAt = args.humanDecisionAt;
    if (args.notionPageId !== undefined) updateData.notionPageId = args.notionPageId;
    if (args.notionUrl !== undefined) updateData.notionUrl = args.notionUrl;
    if (args.severity !== undefined) updateData.severity = args.severity;
    if (args.riskScore !== undefined) updateData.riskScore = args.riskScore;

    await ctx.db.patch(incidents[0]._id, updateData);

    return { success: true };
  },
});

export const upsertIncidentFromSupabase = mutation({
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("securityIncidents")
      .withIndex("by_supabase_id", (q) => q.eq("supabaseId", args.supabaseId))
      .unique();

    const data = {
      ...args,
      updatedAt: Date.now(),
    };

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

export const logIncidentAction = mutation({
  args: {
    incidentId: v.string(),
    actor: v.string(),
    actionType: v.string(),
    reasoning: v.optional(v.string()),
    payload: v.optional(v.string()),
    searchText: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("incidentActions", {
      incidentId: args.incidentId,
      actor: args.actor,
      actionType: args.actionType,
      reasoning: args.reasoning,
      payload: args.payload,
      searchText: args.searchText,
      createdAt: args.createdAt || Date.now(),
    });
  },
});
