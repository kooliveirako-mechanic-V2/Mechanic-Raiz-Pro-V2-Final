
-- Clean trigger-duplicated data so we can import from backup
DELETE FROM public.financeiro_historico;
DELETE FROM public.financeiro;
DELETE FROM public.parcelas_pagamento;
DELETE FROM public.itens_os;
DELETE FROM public.itens_orcamento;
DELETE FROM public.estoque_movimentacoes;
DELETE FROM public.subscriptions;
DELETE FROM public.categorias_financeiras;
DELETE FROM public.centros_custo;
DELETE FROM public.formas_pagamento;
DELETE FROM public.notificacoes;
DELETE FROM public.recorrencias;
DELETE FROM public.ordens_servico;
DELETE FROM public.orcamentos;
DELETE FROM public.veiculos;
DELETE FROM public.clientes;
DELETE FROM public.estoque;
DELETE FROM public.engagement_emails;
DELETE FROM public.lead_followups;
DELETE FROM public.pagamentos;
DELETE FROM public.audit_logs;
DELETE FROM public.oficinas;
DELETE FROM public.profiles;
