// Submits a real abuse report to AbuseIPDB when a human approves blocking a
// high-confidence malicious IP. This is the one real external action beyond
// Notion that fires after human approval -- "blocking" itself is simulated
// (no real firewall is connected), but this report is a genuine API call.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ABUSEIPDB_API_KEY = Deno.env.get("ABUSEIPDB_API_KEY") ?? "";

// AbuseIPDB category codes: 14 = Port Scan, 18 = Brute-Force, 20 = Exploited Host / Malware, 4 = DDoS, 8 = Phishing, 21 = Web App Attack
const CATEGORY_MAP: Record<string, string> = {
  port_scan: "14",
  brute_force: "18",
  malware: "20",
  ddos: "4",
  phishing: "8",
  c2_beacon: "20",
  xss: "21",
  sql_injection: "21",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ip, category, comment } = await req.json();
    if (!ip) throw new Error("ip is required");

    if (!ABUSEIPDB_API_KEY) {
      return new Response(JSON.stringify({ submitted: false, reason: "AbuseIPDB API key not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const categories = CATEGORY_MAP[category] ?? "15"; // 15 = Hacking (generic fallback)

    const response = await fetch("https://api.abuseipdb.com/api/v2/report", {
      method: "POST",
      headers: {
        Key: ABUSEIPDB_API_KEY,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        ip,
        categories,
        comment: comment ?? "Reported by CyberGuard AI incident response pipeline after human-approved block decision.",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ submitted: false, error: data }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ submitted: true, result: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("submit-abuseipdb-report error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
