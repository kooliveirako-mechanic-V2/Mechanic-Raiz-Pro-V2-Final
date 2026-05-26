# Regras de Arquitetura — MechanicRaizPro

## REGRAS INVIOLÁVEIS

### Mobile
- NUNCA usar `text-sm` em inputs, selects ou textareas → usar `text-base` (16px mínimo)
- NUNCA usar `min-w-[NNNpx]` fixo para cards em row → usar `grid-cols-N`
- NUNCA usar `overflow-x-auto` sem `overflow-x-hidden` no wrapper pai
- SEMPRE `min-h-[44px] min-w-[44px]` em elementos clicáveis
- NUNCA usar vaul Drawer para formulários com inputs → usar Drawer custom (`src/components/ui/drawer.tsx`)

### Supabase
- SEMPRE desestruturar `{ data, error }` em toda chamada
- SEMPRE checar `if (error)` antes de continuar
- SEMPRE exibir toast de erro para o usuário
- NUNCA fechar modal antes de confirmar sucesso da operação
- NUNCA deixar botão de submit sem loading state

### Estado
- NUNCA duplicar lógica de cálculo entre componentes → usar `src/lib/`
- SEMPRE usar `useCallback` em funções passadas como prop
- SEMPRE usar `useRef` para dados de formulário em multi-steps quando necessário

### Layout
- SEMPRE `overflow-x-hidden` no MainLayout e no `html/body`
- SEMPRE `min-w-0 flex-1 truncate` em textos dentro de flex containers
- SEMPRE `flex-shrink-0 whitespace-nowrap` em valores monetários em listas
- Padding horizontal padrão mobile: `px-4` (16px cada lado)

### React Query
- SEMPRE usar `enabled: !!dependency` para queries condicionais
- NUNCA usar hooks condicionalmente (dentro de `if`)
- SEMPRE `invalidateQueries` após mutações bem-sucedidas
