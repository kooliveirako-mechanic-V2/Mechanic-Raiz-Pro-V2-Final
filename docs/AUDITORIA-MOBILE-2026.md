# 📱 Auditoria Mobile 360° — Mechanic Raiz Pro
**Data:** 2026-03-19  
**Engenheiro:** Auditoria Técnica Sênior  
**Escopo:** PWA mobile-first, responsividade, performance, bugs reportados

---

## 📱 EIXO 1 — STACK E CONFIGURAÇÃO MOBILE

| Item | Status | Detalhe |
|------|--------|---------|
| Tipo de app | ✅ PWA | `vite-plugin-pwa` com `display: standalone` |
| Meta viewport | ✅ Correto | `maximum-scale=1.0, user-scalable=no, viewport-fit=cover` |
| Manifest | ✅ OK | Ícones 192/512, orientation portrait, scope `/` |
| Service Worker | ✅ OK | Workbox com `skipWaiting`, `clientsClaim`, sem runtimeCaching |
| navigateFallbackDenylist | ✅ OK | `/~oauth` excluído do cache |
| Splash/Ícones iOS | ⚠️ Parcial | `apple-touch-icon` definido, mas sem splash screens dedicadas |
| font-display: swap | ✅ OK | Google Fonts carrega com `display=swap` |

### Observações
- **runtimeCaching vazio** é intencional — evita stale data de assinatura no mobile
- **Font import via CSS `@import`** bloqueia renderização — idealmente mover para `<link>` no HTML (melhoria menor)

---

## 🔍 EIXO 2 — BUGS ESPECÍFICOS DIAGNOSTICADOS

### 🔴 Bug 1 — "Zoom espontâneo ao interagir"
**Status:** ✅ Já mitigado no código atual  
**Causa raiz original:** Inputs com font-size < 16px causam zoom automático no iOS Safari  
**Estado atual:** O componente `Input` (`src/components/ui/input.tsx`) usa `text-base` (16px) no mobile e `md:text-sm` apenas no desktop — **correto**.  
**Viewport:** `maximum-scale=1.0, user-scalable=no` — **correto**.  
**Risco residual:** Nenhum, desde que ninguém adicione `text-sm` a inputs mobile.

### 🔴 Bug 2 — "Tela desce sozinha durante preenchimento"
**Status:** 🔧 CORRIGIDO NESTA AUDITORIA  
**Causa raiz:** 
1. `document.getElementById("valor")?.focus()` em `OrdemServicoFormModal.tsx:244` — forçava foco programático que dispara scroll do browser ao input + abertura de teclado virtual = salto de tela
2. `descricaoInputRef.current?.focus()` em `ServicoRapidoModal.tsx:120` — autoFocus com delay de 50ms dentro de drawer causa scroll instável
3. `scrollIntoView({ behavior: "smooth" })` em telas como Configurações e Auth — pode causar saltos em contextos aninhados

**Correções aplicadas:**
- ❌ Removido `.focus()` em validação de valor (OrdemServicoFormModal)
- ❌ Removido autoFocus do ServicoRapidoModal (conforme ARCHITECTURE_RULES)
- ✅ Drawer custom (`src/components/ui/drawer.tsx`) já impede scroll do body com `position: fixed`

### 🔴 Bug 3 — "OS não conclui no mobile"
**Status:** 🔧 CORRIGIDO NESTA AUDITORIA  
**Causa raiz:** Bug de **stale closure** no `OSRapidaModal`  

O `handleSubmit` é wrapped em `useCallback` mas a dependência `osMode` NÃO estava no array de deps:
```typescript
// ANTES (bugado) — osMode capturado na closure mas nunca atualizado
}, [tiposServicoSelecionados, valorServico, loading, ...]);

// DEPOIS (corrigido) — osMode no array de deps
}, [tiposServicoSelecionados, valorServico, loading, ..., osMode, pendingItensCusto]);
```

**Impacto:** Quando o usuário alternava entre "Finalizar agora" e "Registrar p/ depois", o callback usava o valor ANTIGO de `osMode`. Isso causava:
- OS marcada como "em_andamento" quando deveria ser "finalizado"
- Registro financeiro NÃO criado (porque `isFinalizar` era `false` no closure stale)
- Usuário via tela de sucesso mas OS não era realmente finalizada

### 🟡 Bug 4 — "OS não finaliza no desktop"
**Status:** ✅ Já tratado  
**Causa raiz:** Validação de forma de pagamento obrigatória para finalização (linha 247-250 de OrdemServicoFormModal). Se o campo está vazio, o submit é bloqueado com toast de erro. Isso é **comportamento correto** — o usuário precisa selecionar a forma de pagamento.

**Observação:** O toast pode não ser visível se o usuário não rolar até o topo. Sugestão futura: scroll to error.

---

## 📐 EIXO 3 — LAYOUT E RESPONSIVIDADE

| Item | Status | Detalhe |
|------|--------|---------|
| Breakpoints | ✅ Tailwind padrão | `sm/md/lg/xl`, breakpoint mobile = 768px |
| overflow-x | ✅ Blindado | `overflow-x-hidden` em `html`, `body`, `MainLayout`, `SidebarInset` |
| Touch targets 44x44 | ✅ OK | Botões críticos usam `h-12` (48px), centro BottomNav = 72px |
| Inputs h-12 + text-base | ✅ OK | Padrão em todos os formulários |
| Sidebar mobile | ✅ Sheet | `MobileNav` usa Sheet (Radix) no lado direito |
| BottomNav safe area | ✅ OK | `env(safe-area-inset-bottom)` aplicado |
| Top padding | ✅ OK | `calc(3.5rem + env(safe-area-inset-top))` |
| Drawer max-height | ✅ OK | `max-h-[92dvh]` com `dvh` (correto para mobile) |
| Modais < 375px | ⚠️ Risco | `sm:max-w-2xl` pode ser largo demais em desktop pequeno, mas no mobile usa Drawer |
| Listas longas | ⚠️ Sem virtual scroll | OS e Clientes carregam tudo de uma vez (pendente M2 da auditoria anterior) |
| Kanban mobile | ✅ OK | Scroll horizontal com snap, pills de navegação |
| Sticky footer forms | ✅ OK | `sticky bottom-0` com backdrop-blur |

---

## ⚡ EIXO 4 — PERFORMANCE MOBILE

| Item | Status | Detalhe |
|------|--------|---------|
| Animações GPU | ✅ OK | `transform` e `opacity` via framer-motion |
| Heavy motion removed | ✅ OK | SVG noise, blur, scale removidos (memória de projeto) |
| PageTransition | ✅ Leve | 0.2s, `opacity` + `y: 8px`, sem scale |
| Code splitting | ⚠️ Parcial | Lazy loading no App.tsx mas bundle principal pode ser grande |
| Image optimization | ⚠️ Sem WebP | Imagens usam PNG direto |
| Offline | ✅ Parcial | Service worker cacheia assets, queries falham graciosamente |
| Connection loss | ✅ OK | `ConnectionStatus` component mostra indicador offline |
| Dashboard queries | ⚠️ 8+ paralelas | Pendente consolidação em RPCs (M3 auditoria anterior) |
| Font loading | ⚠️ @import | CSS `@import` bloqueia render — mover para `<link preload>` |

---

## 🍎 EIXO 5 — iOS vs Android

| Item | iOS Safari | Android Chrome |
|------|-----------|----------------|
| Zoom em inputs | ✅ Mitigado | ✅ Sem problema |
| PWA install banner | ❌ Manual (Share→Add) | ✅ Automático |
| `dvh` units | ✅ Suportado iOS 15.4+ | ✅ Suportado |
| `env(safe-area-inset)` | ✅ OK | ✅ OK (notch devices) |
| Body scroll lock | ✅ position:fixed | ✅ position:fixed |
| Rubber-band scrolling | ✅ Bloqueado no drawer | N/A |
| input type="date" | ✅ Nativo | ✅ Nativo |
| touch-manipulation | ✅ Aplicado nos cards | ✅ Aplicado |

---

## 🔐 EIXO 7 — FLUXO COMPLETO OS NO MOBILE

| Etapa | Status | Observação |
|-------|--------|------------|
| 1. App abre → tela inicial | ✅ | `PageLoader` enquanto carrega |
| 2. "Nova OS" → modal abre | ✅ | Drawer custom, sem zoom/salto |
| 3. Seleciona cliente | ✅ | `ClienteSelectWithCreate` funcional |
| 4. Seleciona veículo | ✅ | Filtra por cliente, `h-12 text-base` |
| 5. Botão "Próximo" | ✅ | `h-12`, validação com errors inline |
| 6. Seleciona tipo serviço | ✅ | Select com `z-[9999]`, `max-h-[50vh]` |
| 7. Informa valor | ✅ | `inputMode="decimal"`, `h-14 text-lg` |
| 8. Adiciona peças | ✅ | ServicoRapidoModal como sub-modal |
| 9. Toggle Finalizar/Registrar | 🔧 CORRIGIDO | **Stale closure fixado** |
| 10. Clica "Finalizar" | ✅ | Double-click guard, loading state |
| 11. Tela de sucesso | ✅ | WhatsApp + Concluir buttons |
| 12. Fecha modal | ✅ | Reset completo de estado |

---

## 📊 MATRIZ DE BUGS — RESUMO

| # | Bug | Criticidade | Dispositivo | Causa Raiz | Status |
|---|-----|-------------|-------------|------------|--------|
| B1 | Zoom espontâneo | 🟢 Baixo | iOS | font-size < 16px | ✅ Já mitigado |
| B2 | Tela desce sozinha | 🔴 Crítico | iOS/Android | `.focus()` programático | 🔧 Corrigido |
| B3 | OS não conclui (mobile) | 🔴 Crítico | Todos | stale closure `osMode` | 🔧 Corrigido |
| B4 | OS não finaliza (desktop) | 🟡 Médio | Desktop | Falta forma pagamento | ✅ Comportamento correto |
| B5 | Console warning ref | 🟢 Baixo | Todos | framer-motion interno | ✅ Benigno |

---

## ⚡ QUICK WINS IMPLEMENTADOS

1. ✅ `osMode` adicionado ao array de deps do `useCallback` em `OSRapidaModal`
2. ✅ Removido `.focus()` programático que causava scroll jump em validação
3. ✅ Removido autoFocus do `ServicoRapidoModal` (conforme regras de arquitetura)

---

## 📋 PENDÊNCIAS PARA PRÓXIMA AUDITORIA

| Item | Prioridade | Descrição |
|------|-----------|-----------|
| M2 | 🟡 Médio | Paginação/virtual scroll para listas longas (OS, Clientes) |
| M3 | 🟡 Médio | Consolidar dashboard queries em RPCs |
| P1 | 🟢 Baixo | Mover font `@import` para `<link preload>` no HTML |
| P2 | 🟢 Baixo | Adicionar splash screens dedicadas para iOS |
| P3 | 🟢 Baixo | Otimizar imagens para WebP |
| P4 | 🟢 Baixo | Lighthouse audit completo com scores documentados |

---

## 🧪 CHECKLIST DE TESTES MOBILE PRÉ-DEPLOY

### Dispositivos obrigatórios
- [ ] iPhone SE (tela 375px) — iOS Safari
- [ ] iPhone 14/15 (tela 390px) — iOS Safari  
- [ ] Android intermediário (ex: Moto G) — Chrome
- [ ] Android entrada (ex: Samsung A03) — Chrome
- [ ] Tablet Android 10" — Chrome

### Fluxos críticos
- [ ] Criar OS Rápida → Finalizar → WhatsApp
- [ ] Criar OS Completa → Adicionar itens → Finalizar
- [ ] Kanban: arrastar OS entre colunas (desktop)
- [ ] Kanban: navegar colunas por swipe (mobile)
- [ ] Busca rápida no Dashboard
- [ ] Financeiro: filtrar por período
- [ ] Estoque: editar item (confirmar partial update)
- [ ] Login → Dashboard → criar OS (fluxo completo)

### Condições de teste
- [ ] Conexão 3G simulada (DevTools → Slow 3G)
- [ ] Modo avião (testar degradação offline)
- [ ] Teclado virtual aberto durante formulários
- [ ] Rotação de tela durante preenchimento
