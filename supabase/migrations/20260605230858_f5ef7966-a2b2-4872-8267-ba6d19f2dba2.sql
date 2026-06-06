-- Ajustar search_path para segurança
ALTER FUNCTION public.registrar_movimentacao_manual_estoque() SET search_path = public;
ALTER FUNCTION public.estornar_estoque_os() SET search_path = public;
ALTER FUNCTION public.estornar_venda_balcao() SET search_path = public;