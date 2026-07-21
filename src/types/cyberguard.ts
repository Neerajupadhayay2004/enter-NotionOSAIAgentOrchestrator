import type { Database } from "@/integrations/supabase/types";

export type SecurityIncident = Database["public"]["Tables"]["security_incidents"]["Row"];
export type IncidentEvidence = Database["public"]["Tables"]["incident_evidence"]["Row"];
export type IncidentAction = Database["public"]["Tables"]["incident_actions"]["Row"];
export type AgentStatus = Database["public"]["Tables"]["agent_status"]["Row"];

export type IncidentStatus = SecurityIncident["status"];
export type IncidentSeverity = SecurityIncident["severity"];
export type IncidentCategory = SecurityIncident["category"];
export type EvidenceSource = IncidentEvidence["source"];
export type EvidenceVerdict = IncidentEvidence["verdict"];
export type ActionActor = IncidentAction["actor"];
export type ActionType = IncidentAction["action_type"];
export type AgentName = AgentStatus["agent_name"];
export type AgentState = AgentStatus["state"];

export const INCIDENT_STATUS_LABEL_KEYS: Record<IncidentStatus, string> = {
  detected: "cyberguard.status.detected",
  analyzing: "cyberguard.status.analyzing",
  pending_approval: "cyberguard.status.pendingApproval",
  resolved: "cyberguard.status.resolved",
  dismissed: "cyberguard.status.dismissed",
};

export const INCIDENT_STATUS_BADGE_VARIANT: Record<IncidentStatus, "incident-detected" | "incident-analyzing" | "incident-pending" | "incident-resolved" | "incident-dismissed"> = {
  detected: "incident-detected",
  analyzing: "incident-analyzing",
  pending_approval: "incident-pending",
  resolved: "incident-resolved",
  dismissed: "incident-dismissed",
};

export const SEVERITY_LABEL_KEYS: Record<IncidentSeverity, string> = {
  low: "cyberguard.severity.low",
  medium: "cyberguard.severity.medium",
  high: "cyberguard.severity.high",
  critical: "cyberguard.severity.critical",
};

export const SEVERITY_BADGE_VARIANT: Record<IncidentSeverity, "severity-low" | "severity-medium" | "severity-high" | "severity-critical"> = {
  low: "severity-low",
  medium: "severity-medium",
  high: "severity-high",
  critical: "severity-critical",
};

export const CATEGORY_LABEL_KEYS: Record<IncidentCategory, string> = {
  port_scan: "cyberguard.category.portScan",
  brute_force: "cyberguard.category.bruteForce",
  malware: "cyberguard.category.malware",
  ddos: "cyberguard.category.ddos",
  phishing: "cyberguard.category.phishing",
  c2_beacon: "cyberguard.category.c2Beacon",
};

export const EVIDENCE_SOURCE_LABEL_KEYS: Record<EvidenceSource, string> = {
  shodan: "cyberguard.source.shodan",
  abuseipdb: "cyberguard.source.abuseipdb",
  virustotal: "cyberguard.source.virustotal",
  alienvault_otx: "cyberguard.source.alienvaultOtx",
};

export const VERDICT_LABEL_KEYS: Record<EvidenceVerdict, string> = {
  clean: "cyberguard.verdict.clean",
  suspicious: "cyberguard.verdict.suspicious",
  malicious: "cyberguard.verdict.malicious",
  unknown: "cyberguard.verdict.unknown",
};

export const VERDICT_BADGE_VARIANT: Record<EvidenceVerdict, "verdict-clean" | "verdict-suspicious" | "verdict-malicious" | "verdict-unknown"> = {
  clean: "verdict-clean",
  suspicious: "verdict-suspicious",
  malicious: "verdict-malicious",
  unknown: "verdict-unknown",
};

export const AGENT_LABEL_KEYS: Record<ActionActor, string> = {
  threat_detection: "cyberguard.agent.threatDetection",
  malware_analysis: "cyberguard.agent.malwareAnalysis",
  incident_response: "cyberguard.agent.incidentResponse",
  compliance: "cyberguard.agent.compliance",
  human: "cyberguard.agent.human",
  system: "cyberguard.agent.system",
};

export const ACTION_LABEL_KEYS: Record<ActionType, string> = {
  detect: "cyberguard.action.detect",
  enrich: "cyberguard.action.enrich",
  analyze: "cyberguard.action.analyze",
  decide: "cyberguard.action.decide",
  escalate: "cyberguard.action.escalate",
  human_decision: "cyberguard.action.humanDecision",
  block_executed: "cyberguard.action.blockExecuted",
  notion_synced: "cyberguard.action.notionSynced",
  error: "cyberguard.action.error",
};
