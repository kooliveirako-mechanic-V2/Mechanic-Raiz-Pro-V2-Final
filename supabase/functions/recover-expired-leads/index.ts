import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://odhdronjiiczxyeqtiha.supabase.co/functions/v1/receive-leads";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RECEIVE_LEADS_TOKEN = Deno.env.get("RECEIVE_LEADS_TOKEN");
    if (!RECEIVE_LEADS_TOKEN) {
      throw new Error("RECEIVE_LEADS_TOKEN não configurado");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    
    const { data: expiredSubs, error: subError } = await supabase
      .from("subscriptions")
      .select(`
        id,
        oficina_id,
        trial_ends_at,
        created_at,
        status,
        oficinas!inner (
          id,
          nome,
          telefone,
          user_id
        )
      `)
      .eq("status", "trial")
      .lt("trial_ends_at", now);

    if (subError) throw subError;

    if (!expiredSubs || expiredSubs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum trial expirado encontrado", total: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const leads: any[] = [];
    const oficinasRecuperadas: string[] = [];

    for (const sub of expiredSubs) {
      const oficina = (sub as any).oficinas;
      if (!oficina) continue;

      const { data: userData } = await supabase.auth.admin.getUserById(oficina.user_id);
      if (!userData?.user?.email) continue;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, telefone")
        .eq("user_id", oficina.user_id)
        .single();

      leads.push({
        nome: profile?.nome || oficina.nome,
        email: userData.user.email,
        telefone: profile?.telefone || oficina.telefone || undefined,
        oficina: oficina.nome,
        categoria: "recuperacao-7dias",
      });

      oficinasRecuperadas.push(sub.oficina_id);
    }

    // Enviar leads UM POR UM para o webhook, ignorando duplicatas
    let enviados = 0;
    let duplicados = 0;
    let erros = 0;

    for (const lead of leads) {
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-token": RECEIVE_LEADS_TOKEN,
          },
          body: JSON.stringify([lead]),
        });

        if (res.ok) {
          enviados++;
        } else {
          const text = await res.text();
          if (text.includes("duplicate")) {
            duplicados++;
          } else {
            erros++;
            console.error(`Erro ao enviar lead ${lead.email}:`, text);
          }
        }
      } catch (e) {
        erros++;
        console.error(`Erro de rede ao enviar lead ${lead.email}:`, e);
      }
    }

    // Estender trial em +7 dias para TODOS
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + 7);
    const novaDataISO = novaData.toISOString();

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({ 
        trial_ends_at: novaDataISO,
        updated_at: new Date().toISOString()
      })
      .in("oficina_id", oficinasRecuperadas);

    if (updateError) {
      console.error("Erro ao estender trials:", updateError);
      throw updateError;
    }

    console.log(`Recuperação concluída: ${enviados} novos, ${duplicados} já existiam, ${erros} erros. Trials estendidos até ${novaDataISO}`);

    return new Response(
      JSON.stringify({
        success: true,
        total_leads: leads.length,
        enviados_novos: enviados,
        ja_existiam: duplicados,
        erros,
        trial_estendido_ate: novaDataISO,
        leads: leads.map(l => ({ nome: l.nome, email: l.email, oficina: l.oficina })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Erro na recuperação de leads:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
