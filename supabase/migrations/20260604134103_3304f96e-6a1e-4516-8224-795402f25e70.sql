-- Garantir que o tipo status_os (se existir como ENUM) aceite 'aberto'
-- Se for texto simples, apenas garantimos compatibilidade nas funções

-- Ajustar os filtros de painéis operacionais se necessário
-- (A maioria já usa IN ou exclusão, então 'aberto' deve funcionar naturalmente)

-- Forçar recalculo para qualquer OS que esteja com lucro zerado mas valor_servico preenchido
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.ordens_servico WHERE lucro = 0 AND valor_servico > 0 LOOP
        PERFORM public.recalcular_totais_os(r.id);
    END LOOP;
END $$;