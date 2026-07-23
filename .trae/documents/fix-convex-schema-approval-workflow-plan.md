# Fix Convex Schema & Approval Workflow Implementation Plan

## 1. Problem Summary
- Convex `incidentActions` table schema doesn't match existing documents (missing `searchText`, `payload` fields)
- Need to ensure proper sync between Convex and Supabase for security incidents
- Update approval workflow with "approve/block/delete" and "human/ai/agent" actors

## 2. Files to Modify

### Convex Backend Files
1. `convex/schema.ts` - Update `incidentActions` and `securityIncidents` schemas
2. `convex/securityMutations.ts` - Add missing fields and ensure proper sync
3. `convex/securitySync.ts` - Update to sync all new fields

### Frontend Files
4. `src/hooks/use-security-incidents.ts` - Ensure proper handling of all fields and actors
5. `src/pages/IncidentDetail.tsx` - Add "reject" button (if needed) and ensure all actions work
6. `src/components/cyberguard/pending-approvals-panel.tsx` - Add agent and delete options

## 3. Steps to Implement

### Step 1: Fix Convex Schema (schema.ts)
- Add missing fields to `incidentActions` (`searchText`, `payload`)
- Ensure all fields from Supabase are included in `securityIncidents` (notion_page_id, notion_url, etc.)

### Step 2: Update Security Mutations (securityMutations.ts)
- Ensure all mutations handle the new fields
- Add sync back to Convex when actions are taken

### Step 3: Update Security Sync (securitySync.ts)
- Upsert all new fields from Supabase

### Step 4: Update Frontend Hook
- Make sure deleteIncident is available and works properly
- Update approve/block to handle all actor types

### Step 5: Update UI Components
- Ensure all buttons and workflows are working

## 4. Risk Handling
- Use `v.optional()` for new fields to avoid breaking changes
- Keep backward compatibility with existing data
- Test each change step by step

