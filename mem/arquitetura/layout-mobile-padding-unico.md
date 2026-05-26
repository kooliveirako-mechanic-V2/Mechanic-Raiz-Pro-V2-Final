---
name: Padding mobile aplicado uma única vez
description: Regra para evitar dobra de espaço vertical em mobile/PWA - compensação de TopBar fixa, BottomNav e safe-area
type: constraint
---

A compensação de espaço para TopBar fixa, BottomNav e safe-area em mobile (<1024px) é aplicada UMA ÚNICA VEZ no seletor `[data-app-scroll-root]` em `src/index.css`:
- padding-top: `calc(3.5rem + env(safe-area-inset-top, 0px))` (TopBar h-14 + notch)
- padding-bottom: `calc(5.5rem + env(safe-area-inset-bottom, 0px))` (BottomNav + home indicator)

**PROIBIDO** duplicar esse padding em wrappers internos (MainLayout, páginas, dashboards). Padding duplicado causa vazio vertical enorme acima da saudação e abaixo do conteúdo (sintoma observado: ~112px sobrando no topo, ~190px sobrando no fundo no PWA).

**Why:** Já houve regressão onde MainLayout aplicava `pt-14 pb-20` somado ao padding do scroll root, dobrando os espaços.

**How to apply:** Wrappers internos podem usar apenas padding horizontal (`px-3 md:p-6 lg:p-8`) e gap vertical entre filhos (`space-y-*`). Nunca `pt-*`/`pb-*` que compense TopBar/BottomNav.
