// Creates one realistic simulated security event and kicks off the incident
// response pipeline. Since no real Suricata/Zeek network sensor is connected
// in this environment, events are generated from realistic templates -- the
// OSINT enrichment and Notion/AbuseIPDB actions downstream are all real.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// A mix of known-malicious-ish test IPs (real IPs commonly seen in threat
// intel feeds / documented test ranges) and generic ones, so OSINT lookups
// return varied real results instead of always "clean".
const TEMPLATES = [
  { category: "port_scan", title: "Multi-port TCP scan detected", ips: ["185.220.101.1", "45.155.205.233", "194.147.78.14"] },
  { category: "brute_force", title: "SSH brute-force attempt", ips: ["193.32.162.157", "80.94.95.116", "89.248.165.74"] },
  { category: "malware", title: "Suspicious executable download", ips: ["91.212.166.15", "45.146.164.110"], withHash: true },
  { category: "ddos", title: "Volumetric traffic spike from single source", ips: ["203.0.113.42", "198.51.100.23"] },
  { category: "phishing", title: "Outbound connection to known phishing infra", ips: ["185.220.102.8", "23.129.64.131"] },
  { category: "c2_beacon", title: "Periodic beacon to external host", ips: ["185.220.101.45", "45.155.205.240"], withHash: true },
];

// Real (test-safe, well-known) sample hashes so VirusTotal returns actual data.
const SAMPLE_HASHES = [
  "44d88612fea8a8f36de82e1278abb02f", // EICAR test file MD5
  "275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0", // EICAR SHA256
];

function pad(n: number, width: number) {
  return n.toString().padStart(width, "0");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const sourceIp = template.ips[Math.floor(Math.random() * template.ips.length)];
    const fileHash = template.withHash ? SAMPLE_HASHES[Math.floor(Math.random() * SAMPLE_HASHES.length)] : null;

    const { count } = await supabase.from("security_incidents").select("id", { count: "exact", head: true });
    const incidentNumber = `INC-${pad((count ?? 0) + 1, 4)}`;

    const { data: incident, error: insertError } = await supabase
      .from("security_incidents")
      .insert({
        incident_number: incidentNumber,
        title: template.title,
        category: template.category,
        source_ip: sourceIp,
        file_hash: fileHash,
        status: "detected",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const pipelineResponse = await fetch(`${SUPABASE_URL}/functions/v1/run-incident-pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ incidentId: incident.id }),
    });

    if (!pipelineResponse.ok) {
      console.error("run-incident-pipeline failed:", await pipelineResponse.text());
    }

    return new Response(JSON.stringify({ success: true, incidentId: incident.id, incidentNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("simulate-threat-event error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
