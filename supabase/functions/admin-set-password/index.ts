// Edge Function: admin-set-password
// STATUS: DESATIVADA (Correção 3 — bloqueador de segurança).
//
// Histórico: esta função executava operação administrativa privilegiada.
// A auditoria confirmou que não há nenhuma chamada real (frontend,
// super_admin, recover-legacy-users, fluxo padrão de reset, nem outras
// edge functions). Por isso ela foi inertizada: continua existindo para
// preservar histórico/deploy, mas não possui mais poder administrativo
// algum.
//
// Comportamento atual:
//  - OPTIONS  -> 204 (preflight CORS)
//  - qualquer outro método -> 403 com mensagem genérica
//  - não importa cliente admin, não lê segredos, não aceita headers
//    privilegiados, não chama APIs administrativas de auth, não processa
//    body, não loga dados sensíveis.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({ error: "Função administrativa desativada" }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
