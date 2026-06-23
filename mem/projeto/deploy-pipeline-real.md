---
name: Deploy pipeline real do projeto
description: Produção é mecanicaraizpro.com.br na Vercel via GitHub. Lovable é só preview. Frontend exige ZIP + commit + push manual
type: constraint
---

**REGRA FIXA — NÃO ESQUECER:**

## Produção real
- **Domínio:** `mecanicaraizpro.com.br`
- **Hosting:** **Vercel** (deploy automático a partir do **GitHub**)
- **Lovable NÃO é produção.** `mechanicraizpro.lovable.app` é só preview/dev.
- O botão **`Publish → Update`** do Lovable **NÃO chega no site real do Caíque**. Nunca recomendar clicar em Update achando que vai pra produção.

## Como o frontend vai pra produção
1. Caíque abre o **Code Editor** no Lovable → **Download codebase** (rodapé da sidebar) → baixa ZIP.
2. Extrai por cima da pasta local do repositório.
3. **GitHub Desktop** → revisa diff → commit → push.
4. **Vercel** detecta o push e faz rebuild automático em ~1-2 min.
5. Mudança aparece em `mecanicaraizpro.com.br`.

## Backend (Lovable Cloud / Supabase)
- Migrations SQL e edge functions **sobem automaticamente** quando aplicadas pelo agente.
- Não passam por GitHub nem Vercel.
- Já estão no ar assim que executadas.

## O que NUNCA fazer
- ❌ Dizer "clica em Publish → Update" achando que isso publica em produção.
- ❌ Chamar `preview_ui--publish` esperando que afete `mecanicaraizpro.com.br`.
- ❌ Ignorar o passo manual de ZIP + GitHub Desktop + commit + push.

## O que sempre fazer ao terminar mudança de frontend
Listar explicitamente os arquivos alterados (para o Caíque revisar no diff do GitHub Desktop) e lembrar o passo a passo: Download codebase → copiar → commit → push → Vercel.

**Why:** Caíque já corrigiu isso múltiplas vezes. Confundir Lovable Hosting com a produção dele (Vercel) gera retrabalho e quebra confiança.
