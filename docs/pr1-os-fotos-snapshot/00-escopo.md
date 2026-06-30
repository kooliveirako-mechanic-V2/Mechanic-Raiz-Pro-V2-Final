# PR 1 — Escopo (declarações negativas)

Arquivo separado para não poluir o diff SQL com as palavras-chave da
prova negativa (entregável 6). Os arquivos `.sql` deste pacote
intencionalmente **não citam** os 12 termos proibidos.

## O que o PR 1 NÃO faz

- Não altera `ordens_servico` (sem UPDATE, sem DELETE).
- Não altera arquivos no bucket `os-fotos` (sem renomear, sem mover, sem apagar).
- Não altera privacidade do bucket.
- Não cria, altera ou remove policies de Storage ou de tabelas.
- Não introduz funções com privilégios elevados.
- Não toca frontend, hooks, componentes, edge functions.
- Não promove arquivos de `temp/` para `<os_id>/`.
- Não gera URLs assinadas nem URLs públicas.

## O que o PR 1 faz

- Cria `public.os_fotos_snapshot_pr1` (entregável 1).
- Popula com snapshot único de referências reais (entregável 2).
- Disponibiliza queries de inventário read-only (entregável 3).
