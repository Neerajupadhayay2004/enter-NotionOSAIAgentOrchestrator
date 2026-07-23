import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import type { BudgetRequest as SupabaseBudgetRequest, AgentAction } from "@/types/enterprise-os";

// Define a type that matches both Supabase and Convex structures
type BudgetRequest = Omit<SupabaseBudgetRequest, "id"> & { id: string };

export function useBudgetRequests() {
  const convexRequests = useQuery(api.budgetSync.listAll);
  const upsertConvex = useMutation(api.budgetSync.upsert);
  const recordDecisionConvex = useMutation(api.budgetSync.recordDecision);
  const deleteBySupabaseIdConvex = useMutation(api.budgetSync.deleteBySupabaseId);

  // Convert Convex documents to the format expected by the frontend
  const requests: BudgetRequest[] = convexRequests
    ? convexRequests.map((req) => ({
        id: req.supabaseId || req._id,
        campaign_name: req.campaignName,
        category: req.category,
        requested_amount: req.requestedAmount,
        final_amount: req.finalAmount,
        status: req.status,
        justification: req.justification,
        requested_by: req.requestedBy,
        created_at: new Date(req.updatedAt).toISOString(),
        updated_at: new Date(req.updatedAt).toISOString(),
      }))
    : [];

  const isLoading = convexRequests === undefined;

  const fetchRequests = useCallback(() => {
    // No need to fetch manually, useQuery handles it
  }, []);

  const deleteRequest = useCallback(async (requestId: string) => {
    console.log("[delete] Starting for:", requestId);
    // Delete from Convex
    await deleteBySupabaseIdConvex({ supabaseId: requestId });
    console.log("[delete] Convex delete succeeded");
  }, [deleteBySupabaseIdConvex]);

  const makeDecision = useCallback(async (
    requestId: string,
    decision: "approve" | "reject",
    notes?: string,
  ) => {
    const newStatus = decision === "approve" ? "approved" : "rejected";
    const finalStatus = decision === "approve" ? "completed" : newStatus;

    // Update Convex
    await recordDecisionConvex({
      supabaseId: requestId,
      status: finalStatus,
      humanDecision: decision,
      humanDecisionNotes: notes,
    });
    console.log("[decision] Convex decision sync succeeded");

    return { success: true, status: finalStatus };
  }, [recordDecisionConvex]);

  return { requests, isLoading, refetch: fetchRequests, deleteRequest, makeDecision };
}

export function useBudgetRequest(requestId: string | undefined) {
  const convexRequests = useQuery(api.budgetSync.listAll);
  const request: BudgetRequest | null = convexRequests
    ? convexRequests
        .filter((req) => req.supabaseId === requestId || req._id === requestId)
        .map((req) => ({
          id: req.supabaseId || req._id,
          campaign_name: req.campaignName,
          category: req.category,
          requested_amount: req.requestedAmount,
          final_amount: req.finalAmount,
          status: req.status,
          justification: req.justification,
          requested_by: req.requestedBy,
          created_at: new Date(req.updatedAt).toISOString(),
          updated_at: new Date(req.updatedAt).toISOString(),
        }))[0] || null
    : null;

  const actions: AgentAction[] = []; // We'll add Convex support for agent actions later
  const isLoading = convexRequests === undefined;

  const refetch = useCallback(() => {
    // No need to fetch manually, useQuery handles it
  }, []);

  return { request, actions, isLoading, refetch };
}
