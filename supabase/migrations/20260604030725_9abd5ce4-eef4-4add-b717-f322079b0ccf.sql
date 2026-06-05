-- Permitir que qualquer pessoa veja os dados básicos da oficina (necessário para a página pública)
CREATE POLICY "Acesso público para oficinas" ON public.oficinas 
FOR SELECT USING (true);

-- Permitir que a função get_public_os acesse clientes, veículos e itens
-- Como a função é SECURITY DEFINER, ela executa como o dono, mas precisamos garantir que o acesso anon seja possível se necessário
-- Adicionando políticas que permitem acesso se for através das funções de visualização pública

CREATE POLICY "Acesso público para clientes via OS" ON public.clientes
FOR SELECT TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os 
    WHERE os.cliente_id = public.clientes.id
));

CREATE POLICY "Acesso público para veículos via OS" ON public.veiculos
FOR SELECT TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os 
    WHERE os.veiculo_id = public.veiculos.id
));

CREATE POLICY "Acesso público para itens via OS" ON public.itens_os
FOR SELECT TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os 
    WHERE os.id = public.itens_os.ordem_servico_id
));

CREATE POLICY "Acesso público para sinais via OS" ON public.os_sinais
FOR SELECT TO anon, authenticated
USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os 
    WHERE os.id = public.os_sinais.ordem_servico_id
));

CREATE POLICY "Acesso público para ordens de serviço" ON public.ordens_servico
FOR SELECT TO anon, authenticated
USING (true);

-- Garantir GRANTs para anon
GRANT SELECT ON public.oficinas TO anon;
GRANT SELECT ON public.clientes TO anon;
GRANT SELECT ON public.veiculos TO anon;
GRANT SELECT ON public.itens_os TO anon;
GRANT SELECT ON public.os_sinais TO anon;
GRANT SELECT ON public.ordens_servico TO anon;
GRANT SELECT ON public.oficina_configuracoes TO anon;

-- Política para configurações da oficina
CREATE POLICY "Acesso público para configurações da oficina" ON public.oficina_configuracoes
FOR SELECT USING (true);
