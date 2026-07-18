# Storage Audit — Projeto Novo
**Data:** 2026-07-18  
**Projeto:** kurlgmngmglhvknwxjee  
**Status:** SCRIPT PREPARADO | AUDITORIA EXECUTADA

---

## Buckets (7 total)

| Bucket | Público | Size Limit | MIME Types | Objetos | Observação |
|--------|---------|-----------|-----------|---------|-----------|
| `database_export_16_07_26` | ❌ Privado | Sem limite | Todos | 0 | **Vazio** — bucket de export criado durante migração |
| `marketing` | ✅ Público | Sem limite | Todos | 7 | ZIPs grandes (~114MB cada) — provavelmente arquivos de backup do projeto |
| `marketing_downloads` | ❌ Privado | Sem limite | Todos | 1 | 1 ZIP (~324KB) |
| `oficina-logos` | ✅ Público | 2MB | image/* | 10 | Logos de oficinas reais |
| `os-assinaturas` | ❌ Privado | 1MB | image/png | 3 | Assinaturas de OS |
| `os-fotos` | ✅ Público | 50MB | image/*, video/* | 7 | Fotos de OS |
| `projeto-downloads-privado` | ❌ Privado | Sem limite | Todos | 1 | 1 ZIP grande (~114MB) |

**Total objetos no projeto novo: 29**

---

## Inventário Detalhado

### marketing (7 objetos)
| Path | Tamanho | Data |
|------|---------|------|
| mechanic-update.zip | ~114MB | 2026-06-05 |
| projeto_atualizado_2026.zip | ~109MB | 2026-06-06 |
| projeto_atualizado_definitivo.zip | ~109MB | 2026-06-06 |
| projeto_limpo_para_substituir.zip | ~114MB | 2026-06-06 |
| projeto_v2.zip | ~109MB | 2026-06-06 |
| projeto_v2_atualizado.zip | ~316KB | 2026-06-07 |
| projeto_v3.zip | ~109MB | 2026-06-06 |

**Observação:** Esses ZIPs parecem ser backups do código-fonte do projeto, não arquivos de uso da aplicação. Não são referenciados pelo sistema operacional da oficina.

### oficina-logos (10 objetos)
| Path | Tamanho | Oficina UUID |
|------|---------|-------------|
| 190622ea.../logo.png | 319KB | — |
| 29e07f77.../logo.jpg | 115KB | — |
| 5a302023.../logo.jpg | 46KB | — |
| 837b94fb.../logo.jpeg | 137KB | — |
| 9a360264.../logo.jpg | 1.4MB | — |
| 9a360264.../logo.png | 319KB | — |
| d6112300.../logo.jpg | 233KB | — |
| da46950c.../logo.jpg | 1.1MB | — |
| da46950c.../logo.PNG | 319KB | — |
| dc11cb4b.../logo.png | 1.3MB | — |

### os-assinaturas (3 objetos)
| Path | Tamanho |
|------|---------|
| 8802bffa.../assinatura-1777083513618.png | 11KB |
| temp/assinatura-1778761980273.png | 21KB |
| temp/assinatura-1778762488794.png | 24KB |

### os-fotos (7 objetos)
| Path | Tamanho |
|------|---------|
| 183c5650.../1779333129740-z85nnmk.jpeg | 1.3MB |
| 7b3f4d04.../saida-1777076067161-pi2z78.jpg | 2.5MB |
| 7b3f4d04.../saida-1777076074296-k98d3.jpg | 1.8MB |
| a15cdcd8.../entrada-1777432404894-gktlbwm.jpg | 2.3MB |
| temp/1777432404894-gktlbwm.jpg | 2.3MB |
| temp/1777774400997-llxd1a.jpg | 3.1MB |
| temp/saida-1777432448518-qs9cz5.jpg | 1.9MB |

---

## Análise de Completude

O banco antigo tem muito mais dados de operação (395 OS, 172 oficinas) do que os 29 objetos presentes no projeto novo. Isso indica que os arquivos do banco antigo **não foram migrados** — o projeto novo tem apenas alguns arquivos que foram carregados diretamente durante testes.

### O que está faltando (estimativa)
- Logos de ~162 oficinas (só 10 estão presentes)
- Fotos de OS de ~395 ordens de serviço
- Assinaturas de OS de praticamente todas as OS finalizadas

---

## Status dos Scripts de Migração

| Script | Status |
|--------|--------|
| `scripts/migration/migrate-storage.ts` | SCRIPT PREPARADO — aguarda service role keys de ambos os projetos |

---

## Bloqueio

Para executar a migração real de arquivos do antigo para o novo é necessário:
1. `OLD_SERVICE_ROLE_KEY` — service role key do projeto antigo (`cuhkkoqqeguascdsvtky`)
2. `NEW_SERVICE_ROLE_KEY` — service role key do projeto novo (`kurlgmngmglhvknwxjee`)

Não executar sem esses valores. O script já está preparado com dry-run, paginação, retry e resume.
