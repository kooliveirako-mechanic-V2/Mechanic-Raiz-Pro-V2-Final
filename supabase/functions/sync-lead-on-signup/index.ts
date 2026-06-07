import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = "https://odhdronjiiczxyeqtiha.supabase.co/functions/v1/receive-leads";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RECEIVE_LEADS_TOKEN = Deno.env.get("RECEIVE_LEADS_TOKEN") || Deno.env.get("RECEBER_TOKEN_DE_LEADS");
    if (!RECEIVE_LEADS_TOKEN) {
      throw new Error("RECEIVE_LEADS_TOKEN não configurado");
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userEmail = user.email as string;

    const { nome, telefone, tipo } = await req.json();

    if (!nome) {
      throw new Error("nome é obrigatório");
    }

    // Build lead payload
    const leads = [{
      nome,
      telefone: telefone || undefined,
      email: userEmail,
      categoria: `signup-${tipo || "ambos"}`,
    }];

    // Send to Lead Machine Pro
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": RECEIVE_LEADS_TOKEN,
      },
      body: JSON.stringify(leads),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Webhook retornou ${response.status}: ${errorText}`);
      // Don't fail the signup flow - just log the error
      return new Response(
        JSON.stringify({ success: false, error: `Webhook ${response.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`Lead sincronizado: ${nome} (${userEmail}) tipo=${tipo}`, result);

    return new Response(
      JSON.stringify({ success: true, resultado: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro ao sincronizar lead:", error);
    // Return 200 even on error to not break the signup flow
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
