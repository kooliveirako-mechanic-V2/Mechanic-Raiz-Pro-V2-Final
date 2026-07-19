-- Minimal authenticated read grants for core production data tables validated by real account access
-- Scope intentionally limited to SELECT only on tables proven necessary by frontend reads.

GRANT SELECT ON TABLE public.clientes TO authenticated;
GRANT SELECT ON TABLE public.ordens_servico TO authenticated;
GRANT SELECT ON TABLE public.estoque TO authenticated;
GRANT SELECT ON TABLE public.veiculos TO authenticated;
