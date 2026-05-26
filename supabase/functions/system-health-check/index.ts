import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface HealthCheck {
  data: string;
  status: "healthy" | "warning" | "critical";
  checks?: Record<string, number>;
  alertas?: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── AUTH: shared internal secret required ────────────────────────
  const INTERNAL_SECRET = Deno.env.get("INTERNAL_SECRET");
  const provided = req.headers.get("x-internal-secret");
  const isInternal = !!INTERNAL_SECRET && provided === INTERNAL_SECRET;

  if (!isInternal) {
    return new Response(
      JSON.stringify({ status: "unauthorized" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: osSemFin } = await supabase.rpc("check_os_sem_financeiro");
    const osSemFinCount =
      osSemFin !== null && typeof osSemFin === "number" ? osSemFin : 0;

    const { data: diverg } = await supabase.rpc("check_divergencia_valores");
    const divergCount =
      diverg !== null && typeof diverg === "number" ? diverg : 0;

    await supabase
      .from("estoque")
      .select("id", { count: "exact", head: true })
      .lt("quantidade", 0);

    const { data: orfaos } = await supabase.rpc("check_dados_orfaos");
    const orfaosCount =
      orfaos !== null && typeof orfaos === "number" ? orfaos : 0;

    const { count: clientesSemOficina } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .is("oficina_id", null);

    const checks: Record<string, number> = {
      os_sem_financeiro: osSemFinCount,
      divergencias_valor: divergCount,
      estoque_negativo: 0,
      dados_orfaos: orfaosCount,
      clientes_sem_oficina: clientesSemOficina || 0,
    };

    const alertas: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy";

    for (const [key, value] of Object.entries(checks)) {
      if (value > 0) {
        alertas.push(`${key}: ${value} registro(s) com problema`);
        if (key === "os_sem_financeiro" || key === "divergencias_valor") {
          status = "critical";
        } else if (status !== "critical") {
          status = "warning";
        }
      }
    }

    // Detailed counts logged server-side for operators
    console.log("[health-check] checks:", JSON.stringify(checks));
    console.log("[health-check] alertas:", JSON.stringify(alertas));

    // Internal callers get full payload; we already validated the secret above.
    const result: HealthCheck = {
      data: new Date().toISOString().split("T")[0],
      status,
      checks,
      alertas,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[health-check] error:", error);
    return new Response(
      JSON.stringify({
        data: new Date().toISOString().split("T")[0],
        status: "critical",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
