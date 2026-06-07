import { formatCurrency } from "@/lib/formatters";
import { generateWhatsAppLink } from "@/lib/whatsapp";
import jsPDF from "jspdf";

export interface VendaBalcaoReceiptItem {
  nome_item: string;
  quantidade: number;
  valor_unitario: number;
}

export interface VendaBalcaoReceiptInput {
  numero: number;
  data?: Date;
  itens: VendaBalcaoReceiptItem[];
  valor_total: number;
  forma_pagamento: string;
  cliente_nome?: string | null;
  oficina_nome: string;
  oficina_telefone?: string | null;
  observacao?: string | null;
}

/**
 * Gera texto de recibo para venda de balcão.
 * Sempre inclui o disclaimer "Documento não fiscal".
 */
export function buildVendaBalcaoReceipt(input: VendaBalcaoReceiptInput): string {
  const data = (input.data || new Date()).toLocaleDateString("pt-BR");
  const linhas: (string | null)[] = [
    `*${input.oficina_nome}*`,
    `Recibo de Venda #${input.numero} — ${data}`,
    ``,
    `🔩 *Itens:*`,
    ...input.itens.map(
      (it) =>
        `• ${it.nome_item} (${it.quantidade}x ${formatCurrency(it.valor_unitario)}) — ${formatCurrency(
          it.quantidade * it.valor_unitario,
        )}`,
    ),
    ``,
    `💰 *Total:* ${formatCurrency(input.valor_total)}`,
    `💳 *Pagamento:* ${input.forma_pagamento}`,
    input.cliente_nome ? `👤 *Cliente:* ${input.cliente_nome}` : null,
    input.observacao ? `📝 *Obs:* ${input.observacao}` : null,
    ``,
    `─────────────────────────`,
    `ℹ️ Documento não fiscal.`,
    `${input.oficina_nome}${input.oficina_telefone ? ` — ${input.oficina_telefone}` : ""}`,
  ];

  return linhas.filter((l) => l !== null).join("\n");
}

/**
 * Compartilha o recibo via WhatsApp.
 * - Se telefoneDestino for informado, abre conversa direta.
 * - Caso contrário NÃO abre wa.me/?text (que pode abrir contato anterior do dispositivo).
 *   Em vez disso retorna "needs_phone" para a UI pedir o número.
 */
export function openWhatsAppRecibo(
  texto: string,
  telefoneDestino: string,
): void {
  const link = generateWhatsAppLink(telefoneDestino, texto);
  window.open(link, "_blank");
}

/**
 * Copia o texto do recibo para o clipboard.
 */
export async function copiarRecibo(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gera PDF A6 simples do recibo (formato cupom) e dispara download.
 */
export function baixarReciboPDF(input: VendaBalcaoReceiptInput): void {
  const doc = new jsPDF({ unit: "mm", format: [80, 200] });
  const data = (input.data || new Date()).toLocaleString("pt-BR");
  let y = 8;
  const line = (txt: string, opts?: { bold?: boolean; size?: number; align?: "left" | "center" }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 9);
    const x = opts?.align === "center" ? 40 : 5;
    const split = doc.splitTextToSize(txt, 70);
    split.forEach((s: string) => {
      doc.text(s, x, y, { align: opts?.align ?? "left" });
      y += (opts?.size ?? 9) * 0.45 + 1;
    });
  };
  const sep = () => {
    doc.setLineDashPattern([1, 1], 0);
    doc.line(5, y, 75, y);
    y += 3;
  };

  line(input.oficina_nome, { bold: true, size: 12, align: "center" });
  if (input.oficina_telefone) line(input.oficina_telefone, { size: 8, align: "center" });
  line(`Recibo #${input.numero}`, { bold: true, size: 10, align: "center" });
  line(data, { size: 8, align: "center" });
  sep();

  line("ITENS", { bold: true, size: 9 });
  input.itens.forEach((it) => {
    line(it.nome_item, { size: 9 });
    line(
      `  ${it.quantidade} x ${formatCurrency(it.valor_unitario)} = ${formatCurrency(
        it.quantidade * it.valor_unitario,
      )}`,
      { size: 9 },
    );
  });
  sep();

  line(`TOTAL: ${formatCurrency(input.valor_total)}`, { bold: true, size: 12 });
  line(`Pagamento: ${input.forma_pagamento}`, { size: 9 });
  if (input.cliente_nome) line(`Cliente: ${input.cliente_nome}`, { size: 9 });
  if (input.observacao) line(`Obs: ${input.observacao}`, { size: 9 });
  sep();

  line("Documento nao fiscal", { size: 8, align: "center" });
  line("Obrigado pela preferencia!", { size: 8, align: "center" });

  doc.save(`recibo-venda-${input.numero}.pdf`);
}
