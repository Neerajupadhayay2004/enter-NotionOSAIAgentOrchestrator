// Simulates an attacker interacting with one of the 4 decoy honeypot
// services (SSH, Admin Panel, Database, RDP). Logs the interaction and, for
// attack-shaped events, creates a real security_incidents row and runs it
// through the same 5-agent pipeline as any other detected threat.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ATTACKER_IPS = ["185.220.101.1", "45.155.205.233", "193.32.162.157", "91.212.166.15", "80.94.95.116", "89.248.165.74", "194.147.78.14"];

const SQL_PAYLOADS = [
  "' OR '1'='1' --",
  "admin'--",
  "1; DROP TABLE users;--",
  "' UNION SELECT username, password FROM users--",
];

const SSH_USERNAMES = ["root", "admin", "administrator", "ubuntu", "postgres"];

const SERVICE_CONFIG: Record<string, { eventType: string; category: string; title: string }> = {
  ssh: { eventType: "brute_force_attempt", category: "brute_force", title: "Brute-force login attempt on honeypot SSH service" },
  rdp: { eventType: "brute_force_attempt", category: "brute_force", title: "Brute-force login attempt on honeypot RDP service" },
  database: { eventType: "sql_injection_attempt", category: "sql_injection", title: "SQL injection attempt against honeypot database" },
  admin_panel: { eventType: "connection_attempt", category: "phishing", title: "Suspicious connection attempt to honeypot admin panel" },
};

function pad(n: number, width: number) {
  return n.toString().padStart(width, "0");
}

function buildPayload(service: string): string {
  if (service === "database") return SQL_PAYLOADS[Math.floor(Math.random() * SQL_PAYLOADS.length)];
  if (service === "ssh" || service === "rdp") {
    const user = SSH_USERNAMES[Math.floor(Math.random() * SSH_USERNAMES.length)];
    return `login attempt: ${user} / password123 (attempt ${Math.floor(Math.random() * 20) + 1} of session)`;
  }
  return "GET /wp-admin/admin-ajax.php probing for known CMS vulnerabilities";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { service } = await req.json();
    const config = SERVICE_CONFIG[service];
    if (!config) throw new Error("Unknown honeypot service");

    const sourceIp = ATTACKER_IPS[Math.floor(Math.random() * ATTACKER_IPS.length)];
    const payload = buildPayload(service);

    const { count } = await supabase.from("security_incidents").select("id", { count: "exact", head: true });
    const incidentNumber = `INC-${pad((count ?? 0) + 1, 4)}`;

    const { data: incident, error: insertError } = await supabase
      .from("security_incidents")
      .insert({
        incident_number: incidentNumber,
        title: config.title,
        category: config.category,
        source_ip: sourceIp,
        status: "detected",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase.from("honeypot_events").insert({
      service,
      event_type: config.eventType,
      payload,
      source_ip: sourceIp,
      verdict: "suspicious",
      incident_id: incident.id,
    });

    const pipelineResponse = await fetch(`${SUPABASE_URL}/functions/v1/run-incident-pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ incidentId: incident.id }),
    });
    if (!pipelineResponse.ok) console.error("run-incident-pipeline failed:", await pipelineResponse.text());

    return new Response(JSON.stringify({ success: true, incidentId: incident.id, incidentNumber, sourceIp, payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("simulate-honeypot-attack error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
