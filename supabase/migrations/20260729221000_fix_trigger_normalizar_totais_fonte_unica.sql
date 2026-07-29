-- Correção 1 (parte 2) — QUARTA fonte de custo: o trigger de normalização.
--
-- DESCOBERTO durante o dry-run da parte 1 (20260729220000). Após remover o
-- fallback de recalcular_totais_os, o recálculo NÃO convergiu — e em 2 OS o
-- custo até SUBIU (1266: 343,42 -> 348,82; 1268: 934,96 -> 937,46).
--
-- CAUSA: tg_normalizar_totais_ordem_servico dispara
--   BEFORE INSERT OR UPDATE OF valor_servico, valor_mao_obra
-- e contém a MESMA expressão de fallback. Como recalcular_totais_os grava
-- valor_servico, ela dispara este trigger, que recalculava custo_servico com o
-- custo de HOJE do estoque antes da escrita — neutralizando o patch da parte 1.
--
-- Ou seja: não eram três fontes de custo, eram QUATRO. A auditoria original
-- mapeou recalcular_totais_os, o CMV do relatório e a coluna GENERATED lucro,
-- mas não este trigger.
--
-- PROVA DA CONVERGÊNCIA (dry-run com ROLLBACK, após patchear as duas fontes):
--   OS 1255,1256,1257,1258,1259,1260,1265: custo 0,00 == cmv 0,00 -> div 0,00
--   OS 1266: custo 260,42 == cmv 260,42 -> div 0,00
--   OS 1268: custo 834,48 == cmv 834,48 -> div 0,00
--   Antes do patch do trigger, as mesmas 9 divergiam (25,00 a 102,98).
--
-- ATENÇÃO — ESTE PATCH É LIVE E AFETA TODOS OS CLIENTES: qualquer UPDATE de
--   valor_servico/valor_mao_obra passa a recalcular custo_servico sem fallback.
--   OS com item de custo_unitario=0 e estoque_id preenchido terão custo MENOR
--   e lucro MAIOR ao serem editadas. É a correção aparecendo, não regressão.
--
-- ROLLBACK: scripts/migration/rollback_trg_normalizar_totais_20260729.sql

CREATE OR REPLACE FUNCTION public.tg_normalizar_totais_ordem_servico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_produtos NUMERIC := 0;
  v_total_mao_obra_itens NUMERIC := 0;
  v_total_custo NUMERIC := 0;
  v_tem_itens BOOLEAN := false;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM public.itens_os ios WHERE ios.ordem_servico_id = NEW.id),
    COALESCE(SUM(COALESCE(ios.quantidade, 1) * COALESCE(ios.valor_unitario, 0)), 0),
    COALESCE(SUM(COALESCE(ios.valor_mao_obra, 0)), 0),
    COALESCE(SUM(
      COALESCE(ios.quantidade, 1) * COALESCE(ios.custo_unitario, 0)
    ), 0)
  INTO v_tem_itens, v_total_produtos, v_total_mao_obra_itens, v_total_custo
  FROM public.itens_os ios
  LEFT JOIN public.estoque e ON e.id = ios.estoque_id
  WHERE ios.ordem_servico_id = NEW.id;

  -- Compatibilidade: se algum cliente antigo mandar apenas valor_servico como valor digitado,
  -- tratar como mão de obra quando ainda não há itens.
  IF COALESCE(NEW.valor_mao_obra, 0) <= 0
     AND COALESCE(NEW.valor_servico, 0) > 0
     AND (TG_OP = 'INSERT' OR NEW.valor_servico IS DISTINCT FROM OLD.valor_servico)
     AND NOT v_tem_itens THEN
    NEW.valor_mao_obra := NEW.valor_servico;
  END IF;

  NEW.valor_servico := v_total_produtos + GREATEST(COALESCE(NEW.valor_mao_obra, 0), v_total_mao_obra_itens);
  NEW.custo_servico := v_total_custo;

  RETURN NEW;
END;
$function$
