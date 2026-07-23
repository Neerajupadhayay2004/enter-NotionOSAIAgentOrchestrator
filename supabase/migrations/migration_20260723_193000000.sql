-- Add missing columns to security_incidents
ALTER TABLE public.security_incidents 
ADD COLUMN IF NOT EXISTS human_decision text,
ADD COLUMN IF NOT EXISTS human_decision_notes text,
ADD COLUMN IF NOT EXISTS human_decision_at timestamptz,
ADD COLUMN IF NOT EXISTS ai_decision text,
ADD COLUMN IF NOT EXISTS ai_decision_reasoning text,
ADD COLUMN IF NOT EXISTS ai_decision_at timestamptz,
ADD COLUMN IF NOT EXISTS ai_provider text,
ADD COLUMN IF NOT EXISTS agent_decision text,
ADD COLUMN IF NOT EXISTS agent_decision_reasoning text,
ADD COLUMN IF NOT EXISTS agent_decision_at timestamptz,
ADD COLUMN IF NOT EXISTS agent_confidence numeric,
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_by text;

-- Update the check constraint for status to include 'blocked'
ALTER TABLE public.security_incidents DROP CONSTRAINT IF EXISTS security_incidents_status_check;
ALTER TABLE public.security_incidents ADD CONSTRAINT security_incidents_status_check 
CHECK (status IN ('detected','analyzing','pending_approval','resolved','dismissed','blocked'));

-- Update check constraint for incident_actions actor to include 'ai' and 'agent'
ALTER TABLE public.incident_actions DROP CONSTRAINT IF EXISTS incident_actions_actor_check;
ALTER TABLE public.incident_actions ADD CONSTRAINT incident_actions_actor_check 
CHECK (actor IN ('threat_detection','malware_analysis','incident_response','compliance','human','system','ai','agent'));

-- Update check constraint for incident_actions action_type to include approval/block/delete actions
ALTER TABLE public.incident_actions DROP CONSTRAINT IF EXISTS incident_actions_action_type_check;
ALTER TABLE public.incident_actions ADD CONSTRAINT incident_actions_action_type_check 
CHECK (action_type IN ('detect','enrich','analyze','decide','escalate','human_decision','block_executed','notion_synced','error','approve','block','delete','ai_approval','agent_approval','ai_block','agent_block'));

-- Update RLS policies to allow modifications
DROP POLICY IF EXISTS "Public can view security incidents" ON public.security_incidents;
DROP POLICY IF EXISTS "Public can view incident evidence" ON public.incident_evidence;
DROP POLICY IF EXISTS "Public can view incident actions" ON public.incident_actions;
DROP POLICY IF EXISTS "Public can view agent status" ON public.agent_status;

CREATE POLICY "Public can manage security incidents" ON public.security_incidents
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public can manage incident evidence" ON public.incident_evidence
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public can manage incident actions" ON public.incident_actions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public can manage agent status" ON public.agent_status
  FOR ALL USING (true) WITH CHECK (true);
