-- Correção 1 (parte 1 de 2) — fonte única de custo em recalcular_totais_os.
--
-- ⚠️  NÃO APLIQUE ESTA MIGRATION SOZINHA. Ela EXIGE a parte 2:
--       20260729221000_fix_trigger_normalizar_totais_fonte_unica.sql
--
--     Motivo: esta função grava valor_servico, o que dispara o trigger
--     tg_normalizar_totais_ordem_servico (BEFORE UPDATE OF valor_servico).
--     Enquanto esse trigger mantiver o fallback ao estoque, ele reescreve
--     custo_servico DEPOIS desta função e o patch aqui é neutralizado —
--     foi exatamente o que aconteceu no dry-run de 2026-07-29: o recálculo
--     não convergiu e em 2 OS o custo até SUBIU (1266: 343,42 -> 348,82;
--     1268: 934,96 -> 937,46). Só convergiu com as DUAS partes aplicadas.
--
--     Ordem obrigatória: 20260729220000 (esta) -> 20260729221000 (trigger).
--
-- PROBLEMA MEDIDO (2026-07-29, banco NOVO kurlgmngmglhvknwxjee):
--   Três fontes calculavam o custo da MESMA OS de formas diferentes:
--     recalcular_totais_os -> custo_servico : COALESCE(NULLIF(custo,0), e.custo_unitario, 0)
--     get_metrics_..._unificadas -> CMV     : COALESCE(custo * quantidade, 0)
--     ordens_servico.lucro (GENERATED)      : (valor_servico - custo_servico) - desconto
--   Resultado: 9 OS com dois lucros distintos, R$ 370,48, 9/9 INFLANDO.
--   Pior caso OS #1265: R$ 4,00 na tela vs R$ 40,00 no relatório (10×).
--
-- POR QUE O FALLBACK É ERRADO (não é "resgate de custo real"):
--   e.custo_unitario é o custo de HOJE, não o da data da venda. Provado: 7 linhas
--   de item com entrada de estoque POSTERIOR à OS — ex. OS #1268 (21/05) cujo
--   custo_servico inclui óleo que só entrou no estoque em 13/06, 23 dias depois.
--   Com o fallback, o lucro histórico muda sozinho quando o fornecedor reajusta.
--
-- POR QUE ESTA VIA E NÃO ALINHAR A COLUNA GENERATED:
--   DROP/ADD GENERATED em ordens_servico reescreveria 410 linhas com ACCESS
--   EXCLUSIVE na tabela que toda tela de OS lê. Corrigindo o INSUMO
--   (custo_servico), a coluna lucro fica correta sem alteração de schema, e as
--   três fontes convergem por construção.
--
-- SEGURANÇA ALGÉBRICA: itens_os.quantidade é NOT NULL DEFAULT 1, então
--   COALESCE(quantidade,1)*COALESCE(custo,0) == COALESCE(custo*quantidade,0).
--   As duas expressões passam a ser idênticas — sem caso de borda por nulo.
--
-- BACKFILL DE CUSTO SEGUE DESCARTADO: só 3,4% das movimentações (19 de 564) têm
--   custo_unitario registrado. O custo na data da venda nunca foi gravado.
--   Itens sem custo ficam 0 + ressalva quantificada (Correção 4), nunca estimados.
--
-- EFEITO ESPERADO: custo_servico CAI e lucro SOBE nas 9 OS (a favor do dono).
--   Decisão registrada: sem comunicação retroativa ao cliente — o valor que o
--   cliente final pagou não muda, só o custo interno.
--
-- LEFT JOIN public.estoque foi mantido de propósito: ainda é usado por outras
--   colunas do SELECT e o join por PK é inofensivo.
--
-- ROLLBACK: scripts/migration/rollback_recalcular_totais_os_20260729.sql

CREATE OR REPLACE FUNCTION public.recalcular_totais_os(p_os_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_produtos numeric := 0;
  v_total_servicos_catalogo numeric := 0;
  v_total_mao_obra_itens numeric := 0;
  v_mao_obra_global numeric := 0;
  v_desconto numeric := 0;
  v_valor_servico_atual numeric := 0;
  v_status text;
  v_total_receita_bruta numeric := 0;
  v_total_custo numeric := 0;
  v_financeiro_total_pago numeric := 0;
BEGIN
  SELECT
    COALESCE(os.valor_mao_obra, 0),
    COALESCE(os.valor_servico, 0),
    COALESCE(os.desconto, 0),
    os.status
  INTO v_mao_obra_global, v_valor_servico_atual, v_desconto, v_status
  FROM public.ordens_servico os
  WHERE os.id = p_os_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (auth.uid() IS NULL OR NOT public.has_oficina_access(auth.uid(), (SELECT oficina_id FROM public.ordens_servico WHERE id = p_os_id))) THEN
    RAISE EXCEPTION 'Acesso negado à função %', 'recalcular_totais_os'
      USING ERRCODE = '42501';
  END IF;


  SELECT
    COALESCE(SUM(CASE WHEN ios.tipo = 'produto' OR ios.estoque_id IS NOT NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ios.tipo = 'servico' AND ios.estoque_id IS NULL
      THEN COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)
      ELSE 0 END), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(ios.custo_unitario, 0)
    ), 0)
  INTO v_total_produtos, v_total_servicos_catalogo, v_total_mao_obra_itens, v_total_custo
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = p_os_id;

  -- Contrato oficial:
  -- valor_servico = peças/produtos + serviços de catálogo + maior mão de obra entre global e itemizada.
  -- lucro NÃO é escrito aqui; é GENERATED ALWAYS em ordens_servico.
  v_total_receita_bruta := v_total_produtos + v_total_servicos_catalogo + GREATEST(v_mao_obra_global, v_total_mao_obra_itens);

  -- Safety net para OS finalizada legado: não zera OS já paga se itens antigos estiverem incompletos.
  IF v_total_receita_bruta <= 0 AND v_status = 'finalizado' THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_financeiro_total_pago
    FROM public.financeiro
    WHERE ordem_servico_id = p_os_id
      AND tipo = 'entrada'
      AND origem NOT ILIKE 'Comissão%'
      AND categoria != 'sinal';

    IF v_financeiro_total_pago > 0 THEN
      v_total_receita_bruta := v_financeiro_total_pago + v_desconto;
    ELSIF v_valor_servico_atual > 0 THEN
      v_total_receita_bruta := v_valor_servico_atual;
    END IF;
  END IF;

  UPDATE public.ordens_servico
  SET valor_servico = v_total_receita_bruta,
      custo_servico = v_total_custo
  WHERE id = p_os_id
    AND (
      valor_servico IS DISTINCT FROM v_total_receita_bruta
      OR custo_servico IS DISTINCT FROM v_total_custo
    );
END;
$function$
