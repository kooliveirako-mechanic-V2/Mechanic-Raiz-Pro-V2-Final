-- Garantir acesso público (anon) às oficinas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'oficinas' AND policyname = 'Acesso público para oficinas anon'
    ) THEN
        CREATE POLICY "Acesso público para oficinas anon" ON public.oficinas
        FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Garantir acesso público (anon) às configurações da oficina
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'oficina_configuracoes' AND policyname = 'Acesso público para configurações anon'
    ) THEN
        CREATE POLICY "Acesso público para configurações anon" ON public.oficina_configuracoes
        FOR SELECT TO anon USING (true);
    END IF;
END $$;

-- Verificar se as permissões de GRANT estão corretas para anon
GRANT SELECT ON public.oficinas TO anon;
GRANT SELECT ON public.oficina_configuracoes TO anon;
