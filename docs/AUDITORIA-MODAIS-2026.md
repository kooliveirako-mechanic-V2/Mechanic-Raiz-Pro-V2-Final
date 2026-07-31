# Auditoria do Ciclo de Vida dos Modais — 2026-07-31

**Escopo:** todo `src/components/**` e `src/pages/**`. Diagnóstico apenas — nenhuma
linha de código alterada nesta rodada.

**Método:** varredura de `file:line` em 53 arquivos que renderizam primitivos
(`Dialog`/`Sheet`/`Drawer`/`AlertDialog`/`CommandDialog`) + leitura integral dos 4
guards. Onde não foi possível provar por código, está marcado **INDETERMINADO** —
não há chute.

---

## 0. Erro de método corrigido nesta revisão

A primeira versão deste documento classificou **4 formulários como protegidos** —
`ClienteFormModal`, `VeiculoFormModal`, `EstoqueFormModal` e `OrcamentoFormModal` —
com base na **presença de `ConfirmDialog` no arquivo**.

**Presença de `ConfirmDialog` não é evidência de confirmação de fechamento.** O
mesmo componente é usado para confirmar exclusão de registro. Prova:
`ClienteFormModal.tsx:748` e `:797` têm `title="Excluir cliente"` — confirmam
exclusão, não saída de formulário.

**A única evidência válida é o handler passado ao `onOpenChange` do
`Dialog`/`Drawer`:**

| Forma | Significado |
|---|---|
| `onOpenChange={onOpenChange}` | repasse direto ao pai → **sem proteção** |
| `onOpenChange={handleOpenChange}` ou arrow inline | intercepta → **verificar o que faz** |

Os quatro formulários usam repasse direto — provado:
`ClienteFormModal:684,771` · `VeiculoFormModal:465,545` ·
`EstoqueFormModal:500,538` · `OrcamentoFormModal:846,903`.

**Por que isso importava mais que o número:** se a Fase 1 rodasse com o documento
anterior, esses 4 seriam pulados por "já estarem protegidos" — 4 buracos que
ninguém reabriria, porque o próprio documento dizia que estavam fechados.

---

## 1. Resumo executivo

| | Quantidade |
|---|---|
| Arquivos que renderizam modal | **48** consumidores + **6** primitivos |
| Modais/overlays distintos | ~62 (vários arquivos têm 2+: branch mobile/desktop) |
| Com rascunho (`useAutoSave` **ligado**, não só importado) | **7** |
| Confirma fechamento sujo de verdade | **1** (`ServicoRapidoModal`) |
| Confirma só no mobile, via `window.confirm` | **1** (`OrdemServicoFormModal`) |
| Participam do `childModalLock` | **3** (1 produtor, 2 consumidores) |
| Estado na URL (`useModalUrl`) | **13** pontos de entrada |

> **⚠️ Este quadro foi corrigido em 2026-07-31.** A primeira versão dizia
> "5 confirmam / 5 rascunho / 11 desprotegidos". Estava errado — ver §0.

**Veredito global:** a proteção contra o cenário mais temido — *trocar de app / 4G
cair / minimizar* — **está resolvida e é global**. O guard está no primitivo, não
no consumidor, então vale para os 62 modais de uma vez. O problema real é outro e
mais mundano: **o toque acidental fora do modal**, que fecha o formulário em
silêncio. Aí a proteção é irregular.

---

## 2. Os 4 guards — o que cada um garante (lidos integralmente)

### `src/lib/modalFocusGuard.ts` (96L) — o mais importante

`shouldIgnoreTransientClose()` **bloqueia** o fechamento quando:

| Condição | Linha |
|---|---|
| aba oculta (`visibilityState === "hidden"`) | [:72](../src/lib/modalFocusGuard.ts) |
| documento sem foco (`!document.hasFocus()`) | [:81](../src/lib/modalFocusGuard.ts) |
| < 1200 ms após a aba voltar | [:86](../src/lib/modalFocusGuard.ts) |
| < 1500 ms após recuperar foco | [:91](../src/lib/modalFocusGuard.ts) |
| **exceção:** clique/ESC explícito nos últimos 1500 ms → sempre honra | [:67](../src/lib/modalFocusGuard.ts) |

O comentário em [:76-83](../src/lib/modalFocusGuard.ts) mostra que alguém já
apanhou disso: o Radix dispara `onFocusOutside` **antes** do `visibilitychange`,
então `visibilityState` ainda é `"visible"` no momento do evento. O
`document.hasFocus()` cobre essa janela. Isso não é teoria — é correção de bug
real.

**Onde está ligado:** no primitivo, não no consumidor.
`dialog.tsx:11` (raiz) + `DialogContent` fixa `onFocusOutside` :70,
`onInteractOutside` :76, `onPointerDownOutside` :84, `onEscapeKeyDown` :92,
`onCloseAutoFocus` :96. Idêntico em `sheet.tsx` (:12, :89–115) e `alert-dialog.tsx`
(:11, :55–63). Handlers do consumidor são **encadeados depois**
(`props.onInteractOutside?.(e)` em `dialog.tsx:82`), nunca substituem o guard.

→ **Consequência:** os 62 modais herdam a proteção. Nenhum consumidor precisa
saber que ela existe.

### `src/lib/childModalLock.ts` (33L)

Contador + janela de eco de 500 ms ([:16](../src/lib/childModalLock.ts)) para o pai
não fechar quando o filho fecha e o Radix propaga o evento no mesmo tick.
`markChildModalOpen` :21 · `markChildModalClosed` :25 · `isChildModalActive` :30.

**Adoção incompleta:** 1 produtor (`ItensOSList.tsx:9`), 2 consumidores
(`OrdemServicoFormModal.tsx:2`, `OSRapidaModal.tsx:43`).

### `src/hooks/useModalUrl.ts` (41L)

Guarda o modal aberto em `?modal=<nome>` ([:18](../src/hooks/useModalUrl.ts),
`replace: true` em :35). O comentário :7-8 declara a intenção: "quando o usuário
troca de app (ex: WhatsApp) e volta, o param ainda está na URL → o modal continua
aberto". Efeito colateral valioso: **sobrevive a F5**.

### `src/hooks/useAutoSave.ts` (224L)

`localStorage` com prefixo `mechanic_draft_` ([:40](../src/hooks/useAutoSave.ts)),
expiração de **24 h** (:41, checada em :72-82), debounce de 2 s (:52).
`clearDraft()` só deve ser chamado após submit bem-sucedido (:32-33).

### `src/components/DraftPromptDialog.tsx` (68L)

`<AlertDialog open={open}>` em [:46](../src/components/DraftPromptDialog.tsx)
**sem `onOpenChange`** — proposital: só sai pelos dois botões, forçando decisão.
O cabeçalho :19-21 nomeia a causa: antes o rascunho era aplicado em silêncio e o
formulário de OS nova vinha preenchido com dados de outro cliente — **o caso
Moisés/Luciano #1422**.

---

## 3. Resposta à pergunta central

> *"Mão suja de graxa, no meio do atendimento — ele encosta na tela sem querer ou
> o 4G cai. O sistema perde o trabalho dele? Onde exatamente?"*

São dois cenários com respostas opostas.

### 4G cai / troca de app / minimiza → **NÃO perde. Protegido globalmente.**

O `modalFocusGuard` bloqueia o fechamento em todas as quatro condições de perda de
foco, no nível do primitivo. Vale para os 62 modais.

### Encosta na tela fora do modal → **PODE perder. Depende do formulário.**

Aqui o guard **não** ajuda, e corretamente: a aba está visível, o documento tem
foco, então `shouldIgnoreTransientClose()` retorna `false` e o fechamento
prossegue. É um clique deliberado do ponto de vista do browser.

Três níveis de proteção, hoje irregulares:

Quadro **corrigido** (ver §0 — a versão anterior estava errada):

| Nível | Comportamento | Formulários | Prova |
|---|---|---|---|
| 🟢 Confirma antes | intercepta e pergunta se sujo | **`ServicoRapidoModal`** (único) | handler `:191-199`, ligado em `Drawer:1200` / `Dialog:1217` |
| 🟡 Confirma só no mobile | `window.confirm`; desktop sem nada | **`OrdemServicoFormModal`** | mobile `:1140-1147` · desktop `:1187-1192` |
| 🟡 Rascunho absorve | fecha calado, dado volta ao reabrir | `OSRapidaModal`, `VendaRapidaModal`, `EntradaLoteModal`, `FinanceiroFormModal`, `ClienteFormModal`, `VeiculoFormModal`, `OrcamentoFormModal` | `useAutoSave` chamado (7 sítios) |
| 🔴 Perde tudo | fecha calado, sem rascunho | `FinanceiroPreFiscalModal` (53 campos), `DadosFiscaisModal` (15), `CatalogoServicoFormModal` (12), `AgendamentoOnlineModal` (10), `ItemSelector` (7), `ServicoSelectorModal` (3), `CatalogoBaseModal`, `EstoqueFormModal`, `OficinaFormModal`, `LembretesManutencao`, `ImportCSVModal`, `ImportContactsModal`, `ImportClientesCSVModal` | sem `useAutoSave` e com `onOpenChange={onOpenChange}` |

**Os 4 falsos-positivos, reclassificados:** `ClienteFormModal`, `VeiculoFormModal` e
`OrcamentoFormModal` caem para 🟡 (têm rascunho, mas fecham calados);
`EstoqueFormModal` cai para 🔴 (não tem nem rascunho).

---

## 4. Achados, por gravidade

### 🔴 A-1 — Mesmo formulário, duas proteções (OS)

`OrdemServicoFormModal` é o formulário mais crítico do sistema e se comporta de
formas diferentes conforme o dispositivo:

- **Mobile** ([:1142-1144](../src/components/forms/OrdemServicoFormModal.tsx)):
  confirma antes de fechar, via **`window.confirm` nativo**, e só quando
  `!isEditing`. Checagem de sujo sobre
  `clienteId/veiculoId/valorServico/descricao/pendingItens`.
- **Desktop** ([:1189-1192](../src/components/forms/OrdemServicoFormModal.tsx)):
  **nenhuma confirmação.** Clique fora fecha direto.

Dois problemas: a assimetria, e o `window.confirm` — diálogo nativo do sistema,
visualmente alheio ao app, enquanto o resto do projeto usa `ConfirmDialog`.

**Atenuante:** tem `useAutoSave` (:381), então o dado sobrevive no rascunho. A
perda é de *contexto*, não de dado.

### 🔴 A-2 — Onze formulários sem rede de proteção nenhuma

Os 🔴 da tabela acima têm campos de entrada, não têm rascunho e não confirmam
nada. `FinanceiroPreFiscalModal` (`Drawer` :572 / `Dialog` :586) é o mais sensível
— é o que alimenta o relatório do contador.

Os três de importação (`ImportCSVModal`, `ImportContactsModal`,
`ImportClientesCSVModal`) merecem nota: o usuário pode ter subido um CSV e
mapeado colunas. Fechar por engano descarta tudo.

### 🟡 B-1 — `childModalLock` com adoção parcial

3 arquivos participam. Cinco sítios de modal-dentro-de-modal **não**:

| Sítio | Linha |
|---|---|
| `TeamModal` → AlertDialog de remoção | :446 |
| `CatalogoServicosTab` → confirmação de exclusão | :161 |
| `ParcelasManager` → confirmação de exclusão | :418 |
| `ServicoRapidoModal` → `CloseConfirmDialog` | :1176 |
| `EstoqueQuickActions` → 3 modais filhos | :216-218 |

Todos dependem da imunidade nativa do `AlertDialog` a cliques externos. Para o
clique isso basta. Para **ESC** — se fechar o filho também fecha o pai — não
consegui provar por leitura de código. **INDETERMINADO**, precisa teste em
navegador.

### 🟡 B-2 — Estado do modal: 3 padrões concorrentes

| Padrão | Sobrevive a F5? | Exemplos |
|---|---|---|
| `useModalUrl` (query param) | ✅ sim | 13 pontos de entrada: `Servicos.tsx:99`, `Estoque.tsx:31`, `Agenda.tsx:100`, `BottomNav.tsx:28-29`, `DashboardQuickActions.tsx:69-74` |
| `useState` local no pai | ❌ não | `Clientes.tsx:374-377`, `LembretesManutencao.tsx:164`, `EstoqueQuickActions.tsx:221` |
| Derivado de objeto nulo (`open={!!x}`) | ❌ não | `Solicitacoes.tsx:150,170`, `ItensOSList.tsx:300`, `CatalogoServicosTab.tsx:161` |

O F5 recarrega e o modal só volta se o ponto de entrada usa `useModalUrl`. Quando
há rascunho, o dado volta — mas o usuário tem que reabrir na mão.

### 🟢 C-1 — O que está bom (e não deve ser mexido)

- **Guard de foco no primitivo.** Decisão arquitetural correta: um lugar, 62
  modais protegidos.
- **`DraftPromptDialog` sem `onOpenChange`.** Força decisão explícita. Foi
  resposta a um incidente real (#1422).
- **`markExplicitCloseIntent()` no `DialogClose`/`AlertDialogCancel`**
  (`dialog.tsx:35`, `alert-dialog.tsx:123`): garante que o clique deliberado
  sempre vence o guard.
- **`drawer.tsx:22`** — contador global de body-lock para drawers aninhados não
  corromperem o `style` do `body`. Detalhe que costuma passar batido.
- **`AlertDialog` sem `onInteractOutside`/`onPointerDownOutside`** — imune a
  clique externo por design do Radix. Correto para confirmações destrutivas.

---

## 5. Padrões inconsistentes (o resumo cru)

1. **Confirmação ao fechar sujo:** **1** intercepta de verdade
   (`ServicoRapidoModal`), **1** usa `window.confirm` e só no mobile
   (`OrdemServicoFormModal`), o resto não confirma nada. **Não existe regra.**
2. **Rascunho:** 7 de ~20 formulários têm `useAutoSave` ligado. O resto não — e
   não há critério aparente de por que uns sim e outros não.
3. **Estado:** 3 padrões concorrentes (URL / `useState` / `!!objeto`).
4. **Mobile vs desktop:** ~18 arquivos duplicam o corpo em `Drawer` + `Dialog`.
   Em pelo menos um caso (`OrdemServicoFormModal`) as duas cópias **divergem em
   comportamento**, não só em layout.
5. **`childModalLock`:** 3 de 8 sítios de aninhamento.

---

## 6. Matriz de risco

Ordem: perda de dado > travamento de fluxo > ruído.

| # | Risco | Gravidade | Evidência |
|---|---|---|---|
| 1 | 11 formulários perdem tudo no toque acidental | 🔴 alta | tabela §3 |
| 2 | OS desktop sem confirmação (só rascunho salva) | 🔴 alta | `OrdemServicoFormModal.tsx:1189-1192` |
| 3 | Importações descartam CSV + mapeamento | 🔴 alta | `ImportCSVModal.tsx:215` e afins |
| 4 | F5 fecha modal em 2 dos 3 padrões de estado | 🟡 média | §4 B-2 |
| 5 | ESC em filho pode fechar pai em 5 sítios | 🟡 média | **INDETERMINADO** |
| 6 | `window.confirm` nativo quebra a identidade visual | 🟢 baixa | `OrdemServicoFormModal.tsx:1143` |

---

## 7. Padrão único proposto (para aprovação — nada implementado)

Classificar todo modal em 4 tipos, e o tipo determina o comportamento:

| Tipo | ESC | Clique fora | X / Cancelar | Rascunho |
|---|---|---|---|---|
| **Informativo** (visualização, resumo, detalhe) | fecha | fecha | fecha | não |
| **Formulário limpo** (nada digitado) | fecha | fecha | fecha | não |
| **Formulário sujo** (algo digitado) | **confirma** | **não fecha** | confirma | **sim** |
| **Crítico/atômico** (finalizar OS, pagamento) | não fecha | não fecha | só ação explícita | sim + anti-duplo-envio |

Três regras de apoio:

1. **`ConfirmDialog` sempre** — nunca `window.confirm`.
2. **Mobile e desktop compartilham a lógica de fechamento.** A duplicação
   `Drawer`/`Dialog` é de *layout*; comportamento não se duplica.
3. **Todo formulário com >2 campos tem rascunho.** Some o critério arbitrário.

---

## 7.1 Decisões aprovadas para a Fase 1 (2026-07-31)

### Decisão 1 — `isDirty` por SNAPSHOT, não campo-a-campo

**Escolha: Opção A (snapshot).** Motivo tirado do código: nenhum formulário do
projeto tem `isDirty`/`hasChanges` hoje (varredura em `src/components` = 0
ocorrências). Exigir que cada form declare o contrato = 20 implementações novas
de algo inexistente — a própria causa raiz desta auditoria, repetida. E já há
fonte de verdade pronta: 7 formulários passam o objeto `data` completo ao
`useAutoSave`. Esse objeto **é** o snapshot.

`useModalClose` captura o `data` quando o modal abre e compara com o `data` atual
ao fechar. Só pergunta se mudou.

**As 3 condições obrigatórias contra FALSO-SUJO** (sem elas, o aviso vira ruído e
o mecânico aprende a clicar "sair" no automático — pior que não ter proteção):

1. **Snapshot tirado DEPOIS que os dados de edição carregam**, não no primeiro
   render. Senão todo modal de edição abre "sujo" (snapshot vazio × dados
   preenchidos) e pergunta a quem só abriu e fechou.
2. **Campos voláteis fora da comparação** — timestamps, IDs gerados, flags de UI,
   valores auto-preenchidos por seleção (ex.: veículo que muda ao escolher
   cliente). Se entrarem, fica sujo sempre.
3. **`""`, `null` e `undefined` tratados como equivalentes.** Campo que nasce
   `undefined` e o React vira `""` ao montar produziria sujeira falsa.

Se qualquer uma das três não puder ser garantida num formulário, ele **não**
recebe snapshot — fica com confirmação incondicional ou só rascunho. Snapshot
ingênuo é rejeitado.

### Decisão 2 — modais de importação: confirmação, nunca rascunho

`ImportCSVModal`, `ImportContactsModal`, `ImportClientesCSVModal`: rascunho é
**impossível**, não difícil. `useAutoSave` grava via `JSON.stringify`, e um objeto
`File` vira `{}`. Prometer "rascunho recuperado" seria mentira — o usuário
reabriria com o mapeamento sem o arquivo.

**Regra:** só `ConfirmDialog` ao fechar, e **apenas** quando já houver arquivo
carregado ou colunas mapeadas. Modal recém-aberto sem seleção fecha calado — não
há o que perder.

### Desenho do `useModalClose` (para revisão — não implementado)

```ts
// src/hooks/useModalClose.ts
interface Options<T> {
  open: boolean;
  data: T;                       // mesmo objeto passado ao useAutoSave
  onOpenChange: (o: boolean) => void;
  onReset?: () => void;
  ignoreKeys?: (keyof T)[];      // condição 2: campos voláteis
  enabled?: boolean;             // false → fecha sempre (importação recém-aberta)
}

// Regras:
// - snapshot capturado em useEffect quando open passa a true E data já carregou
//   (condição 1)
// - comparação normaliza ""/null/undefined como iguais (condição 3) e ignora
//   ignoreKeys (condição 2)
// - se enabled === false ou !isDirty → fecha direto
// - se isDirty → setConfirmOpen(true), não fecha
export function useModalClose<T>(o: Options<T>): {
  handleOpenChange: (open: boolean) => void;  // vai no Drawer E no Dialog (mesmo)
  confirmOpen: boolean;
  setConfirmOpen: (v: boolean) => void;
};
```

Cada formulário muda **uma linha**: `onOpenChange={handleOpenChange}` no `Drawer` e
no `Dialog`. Mobile e desktop passam a compartilhar a lógica — a assimetria do
`OrdemServicoFormModal` morre por construção, não por disciplina.

### Ordem de execução (invertida vs. proposta original)

1. **`FinanceiroPreFiscalModal` sozinho, primeiro.** 53 campos, alimenta o
   relatório do contador, é onde saíram os bugs de `data_competencia` e cálculo de
   lucro. Vira a referência viva do padrão — se algo falha, falha em 1 arquivo.
2. `useModalClose` + `ConfirmDialog` nos demais 🔴 (rede visível: avisa antes)
3. `useAutoSave` onde couber (rede invisível: se perdeu, o dado volta)
4. Unificar `OrdemServicoFormModal` (um handler p/ Drawer+Dialog; trocar
   `window.confirm` por `ConfirmDialog`)

### Fora de escopo até teste em celular real

`useModalUrl` com `replace: true` (`:35`) — hipótese de que quebra o Voltar do
Android. Não mexer por leitura de código; exige teste em aparelho.

---

## 8. Plano em fases

**Fase 1 — impede perda de dado do cliente**
- `useAutoSave` nos 11 formulários 🔴 (prioridade: `FinanceiroPreFiscalModal`, os 3 de importação)
- Confirmação de sujo no desktop da OS + trocar `window.confirm` por `ConfirmDialog`
- Unificar o handler de fechamento entre `Drawer` e `Dialog` no mesmo arquivo

**Fase 2 — destrava fluxo**
- `childModalLock` nos 5 sítios de aninhamento restantes
- Padronizar estado: `useModalUrl` para todo modal que o usuário alcança direto
- Resolver os INDETERMINADO com teste de navegador

**Fase 3 — polimento**
- Extrair um `useModalClose({ isDirty, hasDraft })` para eliminar a duplicação
- Documentar o padrão no `CLAUDE.md`

---

## 9. INDETERMINADO — o que exige navegador

Os 10 cenários de teste pedidos **não foram executados**: exigem navegador com
sessão logada, que não tenho neste ambiente. O que consegui provar veio de leitura
de código; o que depende de runtime está aberto:

| # | Cenário | Por que não provei |
|---|---|---|
| 1 | F5 com dados preenchidos | precisa de sessão real |
| 2 | Navegação interna com modal aberto (estado órfão) | idem |
| 3 | Trocar de aba 2 min → sessão revalida e derruba? | o guard cobre o fechamento, mas **não** sei se o refetch do React Query ou a revalidação de sessão derruba o modal por outro caminho |
| 4 | Botão Voltar do Android | `useModalUrl` usa `replace: true` (`useModalUrl.ts:35`), então **não** cria entrada no histórico → o Voltar provavelmente sai da página em vez de fechar o modal. **Hipótese forte, não provada.** |
| 5 | Clique fora acidental | comportamento inferido do código (§3), não observado |
| 6 | Fechar filho mantém pai aberto | provado só para os 3 sítios com `childModalLock` |
| 7 | Offline no submit | não sei se o modal fecha mesmo com erro |
| 8 | Duplo toque (duplicação/travamento) | não verifiquei anti-duplo-envio |
| 9 | Deep link para registro inexistente | não sei se trata ou fica em branco |
| 10 | Rotação de tela | não testado |

O **#4 é o mais importante** dos abertos: se o Voltar do Android sai da página em
vez de fechar o modal, é atrito diário para quem usa celular — e o `replace: true`
sugere exatamente isso.
