# PR 2 — Entregável 9/9: Checklist planejado

## ⚠️ Pré-requisitos OBRIGATÓRIOS (bloqueadores de execução)

**PR2 SQL NÃO PODE SER EXECUTADO até que TODOS os pré-requisitos abaixo estejam verdes:**

| # | Pré-requisito | Como validar | Status |
|---|---|---|---|
| 0 | Helper `resolveFotoUrl()` deployado em PRODUÇÃO | Abrir produção, inspecionar Network tab em OS com fotos, confirmar que imagens carregam via `getPublicUrl()` | ⏳ Pendente |
| 1 | Smoke test verde em preview | Abrir preview, carregar OS existente (com URLs públicas), confirmar fotos renderizam sem 404 | ⏳ Pendente |
| 2 | Build limpo | `npm run build` sem erros nem warnings de TypeScript | ⏳ Pendente |

**Se qualquer pré-requisito estiver 🔴, ABORTAR execução do PR2 SQL.**
