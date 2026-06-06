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

    const { oficina_id, cliente_ids } = await req.json();

    if (!oficina_id) {
      throw new Error("oficina_id é obrigatório");
    }

    // Fetch clients
    let query = supabase
      .from("clientes")
      .select("nome, telefone, endereco")
      .eq("oficina_id", oficina_id)
      .not("telefone", "is", null);

    if (cliente_ids && cliente_ids.length > 0) {
      query = query.in("id", cliente_ids);
    }

    const { data: clientes, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    if (!clientes || clientes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, enviados: 0, message: "Nenhum cliente com telefone" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map to webhook format
    const leads = clientes.map((c) => ({
      nome: c.nome,
      telefone: c.telefone,
      endereco: c.endereco || undefined,
      categoria: "cliente-oficina",
    }));

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
      throw new Error(`Webhook retornou ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`Enviados ${clientes.length} leads para Lead Machine Pro`, result);

    return new Response(
      JSON.stringify({ success: true, enviados: clientes.length, resultado: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro ao enviar leads:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
