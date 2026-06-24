-- Remover políticas públicas diretas legadas; acesso público deve passar por RPCs controladas.
DROP POLICY IF EXISTS "Acesso público para clientes via OS" ON public.clientes;
DROP POLICY IF EXISTS "Acesso público para veículos via OS" ON public.veiculos;
DROP POLICY IF EXISTS "Acesso público para itens via OS" ON public.itens_os;
DROP POLICY IF EXISTS "Acesso público para sinais via OS" ON public.os_sinais;

DROP POLICY IF EXISTS "Acesso público para oficinas" ON public.oficinas;
DROP POLICY IF EXISTS "Acesso público para oficinas anon" ON public.oficinas;
DROP POLICY IF EXISTS "Acesso público para configurações anon" ON public.oficina_configuracoes;
DROP POLICY IF EXISTS "Acesso público para configurações da oficina" ON public.oficina_configuracoes;