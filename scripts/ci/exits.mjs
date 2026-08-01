#!/usr/bin/env node
// exits_unguarded — conta caminhos de saída de modal que NÃO passam por handleOpenChange.
//
// Em Node, não bash: a versão bash (exits.sh) deu falso-verde (reportou 0 com
// furo presente) por quoting/pipefail — falha dupla. Matching em JS é
// determinístico, sem inferno de escape. Ver commits 38ab25a e 4326986.
//
// Meta: exits_unguarded = 0 em todo arquivo PROTEGER.
//
//   node scripts/audit/exits.mjs                # os já protegidos
//   node scripts/audit/exits.mjs <arquivo...>   # arquivos dados
//
// 5 padrões de saída (linha a linha, ignorando linha que já cita handleOpenChange):
//   P1 onOpenChange={onOpenChange}          Dialog/Drawer em repasse direto
//   P2 onClick={() => onOpenChange(false)}  botão lateral (Cancelar/ghost/Fechar)
//   P3 onOpenChange={(  ...                  arrow inline sem handleOpenChange
//   P4 DialogClose / DrawerClose            primitivo de fechamento
//   P5 onClick={() => setXOpen(false)}      estado local fechado direto

import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

const PROTEGIDOS = [
  "src/components/forms/FinanceiroPreFiscalModal.tsx",
  "src/components/configuracoes/DadosFiscaisModal.tsx",
  "src/components/vendas/VendaRapidaModal.tsx",
  "src/components/forms/OficinaFormModal.tsx",
  "src/components/forms/VeiculoFormModal.tsx",
  "src/components/estoque/CatalogoServicoFormModal.tsx",
  "src/components/orcamentos/ItemSelector.tsx",
  "src/components/servicos/ServicoSelectorModal.tsx",
  "src/components/veiculos/LembretesManutencao.tsx",
  "src/components/estoque/ImportCSVModal.tsx",
  "src/components/clientes/ImportContactsModal.tsx",
  "src/components/clientes/ImportClientesCSVModal.tsx",
];

const alvos = process.argv.slice(2).length ? process.argv.slice(2) : PROTEGIDOS;

// Cada padrão é uma função linha->bool. Uma linha que cita handleOpenChange já
// está guardada e não conta.
const guarded = (line) => line.includes("handleOpenChange");

const patterns = {
  P1: (l) => /onOpenChange=\{onOpenChange\}/.test(l),
  P2: (l) => /onClick=\{\(\)\s*=>\s*onOpenChange\(false\)\}/.test(l),
  // P3: arrow inline no onOpenChange do Dialog/Drawer RAIZ do formulário.
  // Refino por ESCOPO, não por nome de componente: um arrow cujo corpo só faz
  // set*(null) / setDeleteId / setXxx(null) é fechamento de confirmação aninhada
  // (ex.: AlertDialog de exclusão), não do formulário — não perde dado de form.
  // Filtrar por "é AlertDialog?" quebraria no dia de um Dialog aninhado; por isso
  // o critério é o corpo do handler, não o componente.
  P3: (l) => {
    if (!/onOpenChange=\{\(/.test(l) || guarded(l)) return false;
    // corpo que só limpa um id/seleção de confirmação => não é saída de formulário
    const confirmacaoAninhada = /=>\s*!?\w*\s*&&?\s*set\w*(Id|Confirm|Delete|ToRemove)?\(null\)/.test(l)
      || /=>\s*set(DeleteId|ConfirmOpen|ItemToRemove|MemberToRemove)\(/.test(l);
    return !confirmacaoAninhada;
  },
  P4: (l) => /\b(DialogClose|DrawerClose)\b/.test(l),
  P5: (l) => /onClick=\{\(\)\s*=>\s*set[A-Za-z]*Open\(false\)\}/.test(l) && !guarded(l),
};

let totalGeral = 0;
const rows = [];

for (const f of alvos) {
  if (!existsSync(f)) {
    rows.push({ nome: basename(f), erro: "nao encontrado" });
    continue;
  }
  const lines = readFileSync(f, "utf8").split("\n");
  const c = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  const hits = [];
  lines.forEach((line, i) => {
    for (const [name, test] of Object.entries(patterns)) {
      if (test(line)) {
        c[name]++;
        hits.push(`${name} L${i + 1}: ${line.trim().slice(0, 70)}`);
      }
    }
  });
  const soma = c.P1 + c.P2 + c.P3 + c.P4 + c.P5;
  totalGeral += soma;
  rows.push({ nome: basename(f), c, soma, hits });
}

const H = "ARQUIVO".padEnd(42);
console.log(`${H} P1 P2 P3 P4 P5  exits_unguarded`);
console.log("-".repeat(84));
for (const r of rows) {
  if (r.erro) {
    console.log(`${r.nome.padEnd(42)}  (${r.erro})`);
    continue;
  }
  const { c, soma } = r;
  const marca = soma > 0 ? "  <-- FURO" : "";
  console.log(
    `${r.nome.padEnd(42)} ${String(c.P1).padStart(2)} ${String(c.P2).padStart(2)} ${String(c.P3).padStart(2)} ${String(c.P4).padStart(2)} ${String(c.P5).padStart(2)}  ${soma}${marca}`
  );
}
console.log("-".repeat(84));
console.log(`TOTAL exits_unguarded: ${totalGeral}`);
if (totalGeral > 0) {
  console.log("\nFUROS (arquivo:linha):");
  for (const r of rows) {
    if (r.hits && r.hits.length) {
      console.log(`  ${r.nome}:`);
      r.hits.forEach((h) => console.log(`    ${h}`));
    }
  }
  process.exit(1);
}
console.log("OK — nenhum caminho de saida desprotegido.");
