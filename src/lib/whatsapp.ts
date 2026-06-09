import { OrdemServico } from "@/hooks/useOrdensServico";
import { Orcamento, ItemOrcamento } from "@/hooks/useOrcamentos";
import { ItemOS } from "@/hooks/useItensOS";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";

function getBaseUrl(): string {
  // BLINDAGEM MÁXIMA: Sincronizado com src/utils/url.ts para garantir 100% de certeza.
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    return window.location.origin;
  }
  return "https://www.mechanicraizpro.com.br";
}


export function getPublicOSLink(ordem: OrdemServico): string {
  const identifier = (ordem as any).numero || ordem.id;
  return `${getBaseUrl()}/os/${identifier}`;
}

export function getPublicOrcamentoLink(orcamento: Orcamento): string {
  const identifier = orcamento.numero || orcamento.id;
  return `${getBaseUrl()}/orcamento/${identifier}`;
}

export function formatOSMessage(
  ordem: OrdemServico,
  oficinaNome: string,
  itensOS: ItemOS[] = [],
): string {
  const data = ordem.data_servico.split("-").reverse().join("/");

  const statusLabels: Record<string, string> = {
    pendente: "⏳ Aguardando",
    em_andamento: "🔧 Em Andamento",
    aguardando_peca: "📦 Aguardando Peça",
    finalizado: "✅ Finalizado",
    cancelado: "❌ Cancelado",
  };

  // CAUSA RAIZ: valor_servico JÁ inclui itens (via recalcOSTotals). Não somar novamente.
  const valorServicoOS = Number(ordem.valor_servico || 0);

  // ── 3 BLOCOS SEPARADOS: Serviços / Peças / Mão de Obra ──
  const servicosBase = itensOS.filter((i) => (i.tipo ?? "servico") === "servico");
  const produtosBase = itensOS.filter((i) => (i.tipo ?? "servico") === "produto");

  const servicoRows = servicosBase.map((i) => {
    const mo = Number(i.valor_mao_obra ?? 0);
    const total = Number(i.valor_total ?? 0);
    return { nome: i.nome_item, valor: mo > 0 ? mo : total };
  });
  const pecaRows = produtosBase.map((i) => ({
    nome: i.nome_item,
    quantidade: Number(i.quantidade || 0),
    valor_unitario: Number(i.valor_unitario || 0),
    subtotal: Number(i.quantidade || 0) * Number(i.valor_unitario || 0),
  }));
  // MÃO DE OBRA — apenas vinculada a peças (MO dos serviços já está no valor do serviço acima)
  const moRows: Array<{ origem: string; nome: string; valor: number }> = [
    ...produtosBase
      .filter((i) => Number(i.valor_mao_obra ?? 0) > 0)
      .map((i) => ({ origem: "Peça", nome: i.nome_item, valor: Number(i.valor_mao_obra) })),
  ];

  const subServ = servicoRows.reduce((a, r) => a + r.valor, 0);
  const subPec = pecaRows.reduce((a, r) => a + r.subtotal, 0);
  const subMO = moRows.reduce((a, r) => a + r.valor, 0);
  const itensCalc = subServ + subPec + subMO;
  const subtotalBruto = valorServicoOS > 0 ? valorServicoOS : itensCalc;
  const descontoOS = Number((ordem as any).desconto || 0);
  const valorTotal = Math.max(subtotalBruto - descontoOS, 0);

  const lines: (string | null)[] = [
    `🔧 *${oficinaNome}*`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `📋 *Ordem de Serviço*`,
    ``,
    `👤 *Cliente:* ${ordem.cliente?.nome || "N/A"}`,
    `🚗 *Veículo:* ${ordem.veiculo?.marca} ${ordem.veiculo?.modelo}`,
    ordem.veiculo?.placa ? `🔖 *Placa:* ${ordem.veiculo.placa}` : null,
    ``,
    `🛠️ *Serviço:* ${ordem.tipo_servico}`,
    ordem.descricao ? `📝 *Descrição:* ${ordem.descricao}` : null,
    `📅 *Data:* ${data}`,
    `${statusLabels[ordem.status] || ordem.status}`,
  ];

  // ── 1) Serviços Executados ──
  if (servicoRows.length > 0) {
    lines.push(``);
    lines.push(`🔧 *Serviços Executados:*`);
    for (const r of servicoRows) {
      lines.push(`  • ${r.nome} — ${formatCurrency(r.valor)}`);
    }
    lines.push(`  _Subtotal Serviços: ${formatCurrency(subServ)}_`);
  }

  // ── 2) Peças Utilizadas ──
  if (pecaRows.length > 0) {
    lines.push(``);
    lines.push(`📦 *Peças Utilizadas:*`);
    for (const r of pecaRows) {
      const detalhe = r.quantidade > 1 ? ` (${r.quantidade}x ${formatCurrency(r.valor_unitario)})` : "";
      lines.push(`  • ${r.nome}${detalhe} — ${formatCurrency(r.subtotal)}`);
    }
    lines.push(`  _Subtotal Peças: ${formatCurrency(subPec)}_`);
  }

  // ── 3) Mão de Obra (separada) ──
  if (moRows.length > 0) {
    lines.push(``);
    lines.push(`💵 *Mão de Obra:*`);
    for (const r of moRows) {
      lines.push(`  • [${r.origem}] ${r.nome} — ${formatCurrency(r.valor)}`);
    }
    lines.push(`  _Subtotal Mão de Obra: ${formatCurrency(subMO)}_`);
  }

  lines.push(``);
  if (descontoOS > 0) {
    lines.push(`💰 *Subtotal:* ${formatCurrency(subtotalBruto)}`);
    const motivo = (ordem as any).desconto_motivo;
    lines.push(`🏷️ *Desconto${motivo ? ` (${motivo})` : ""}:* -${formatCurrency(descontoOS)}`);
  }
  lines.push(`💰 *VALOR TOTAL: ${formatCurrency(valorTotal)}*`);

  const sinalRecebido = Number((ordem as any).valor_sinal || 0);
  if (sinalRecebido > 0) {
    const saldo = Math.max(valorTotal - sinalRecebido, 0);
    lines.push(`💵 *Sinal recebido:* ${formatCurrency(sinalRecebido)}`);
    if (saldo > 0) {
      lines.push(`📋 *Saldo a pagar:* ${formatCurrency(saldo)}`);
    } else {
      lines.push(`✅ *Pago integralmente*`);
    }
  }

  lines.push(ordem.tem_garantia ? `✅ *Garantia:* ${ordem.dias_garantia} dias` : null);
  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`📲 *Veja a OS completa:*`);
  lines.push(getPublicOSLink(ordem));
  lines.push(``);
  lines.push(`Responda para confirmar! 👍`);

  return lines.filter((l) => l !== null).join("\n");
}

export function formatOrcamentoMessage(
  orcamento: Orcamento,
  oficinaNome: string,
  linkPublico: string,
  itensOrcamento: ItemOrcamento[] = [],
): string {
  const valorFinal = formatCurrency((orcamento.valor_total || 0) - (orcamento.desconto || 0));

  const servicos = itensOrcamento.filter(i => i.tipo === "servico");
  const produtos = itensOrcamento.filter(i => i.tipo === "produto");
  
  const lines: (string | null)[] = [];

  // Greeting with client name
  if (orcamento.cliente?.nome) {
    lines.push(`Olá ${orcamento.cliente.nome}! 👋`);
  } else {
    lines.push(`Olá! 👋`);
  }
  lines.push(``);
  lines.push(`Segue o orçamento *#${orcamento.numero || 'N/A'}* da *${oficinaNome}*:`);
  lines.push(``);

  // Vehicle info
  if (orcamento.veiculo) {
    lines.push(`🚗 *Veículo:* ${orcamento.veiculo.marca} ${orcamento.veiculo.modelo}${orcamento.veiculo.placa ? ` (${orcamento.veiculo.placa})` : ''}`);
    lines.push(``);
  }

  // Services section
  if (servicos.length > 0) {
    lines.push(`🔧 *Serviços:*`);
    for (const item of servicos) {
      const total = formatCurrency(item.valor_total || 0);
      if (item.quantidade > 1) {
        const unit = formatCurrency(item.valor_unitario || 0);
        lines.push(`  • ${item.nome_item} (${item.quantidade}x ${unit}) — ${total}`);
      } else {
        lines.push(`  • ${item.nome_item} — ${total}`);
      }
    }
    lines.push(``);
  }

  // Products section
  if (produtos.length > 0) {
    lines.push(`🔩 *Peças:*`);
    for (const item of produtos) {
      const total = formatCurrency(item.valor_total || 0);
      if (item.quantidade > 1) {
        const unit = formatCurrency(item.valor_unitario || 0);
        lines.push(`  • ${item.nome_item} (${item.quantidade}x ${unit}) — ${total}`);
      } else {
        lines.push(`  • ${item.nome_item} — ${total}`);
      }
    }
    lines.push(``);
  }

  // Fallback if no items — show title/description
  if (servicos.length === 0 && produtos.length === 0) {
    lines.push(`📌 *${orcamento.titulo}*`);
    if (orcamento.descricao) {
      lines.push(`📝 ${orcamento.descricao}`);
    }
    lines.push(``);
  }

  // Discount
  if ((orcamento.desconto || 0) > 0) {
    lines.push(`🏷️ *Desconto:* ${formatCurrency(orcamento.desconto || 0)}`);
  }

  // Total
  lines.push(`💰 *Total: ${valorFinal}*`);

  // Validity
  if (orcamento.validade) {
    const [year, month, day] = orcamento.validade.split("-");
    lines.push(`⏳ *Válido até:* ${day}/${month}/${year}`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(``);
  lines.push(`📋 *Veja o orçamento completo e aprove aqui:*`);
  lines.push(linkPublico);
  lines.push(``);
  lines.push(`✅ Responda para aprovar!`);

  return lines.filter((l) => l !== null).join("\n");
}

export function generateWhatsAppLink(phone: string, message: string): string {
  let cleanPhone = phone.replace(/\D/g, "");
  
  // BLINDAGEM: Garantir código do país 55 (Brasil) se não tiver
  if (cleanPhone.length <= 11 && !cleanPhone.startsWith("55")) {
    cleanPhone = `55${cleanPhone}`;
  }
  
  const encodedMessage = encodeURIComponent(message);
  
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export async function openWhatsAppOS(
  ordem: OrdemServico,
  oficinaNome: string,
  telefoneOficina?: string | null,
  itensOS: ItemOS[] = [],
  manualPhone?: string,
): Promise<void> {
  // CAUSA RAIZ: alguns callers (lista de Serviços, modal de edição) não passavam
  // os itens, então a mensagem saía só com o valor total. Quando vier vazio,
  // buscamos do banco antes de gerar a mensagem.
  let itens = itensOS;
  if ((!itens || itens.length === 0) && ordem?.id) {
    try {
      const { data } = await supabase
        .from("itens_os")
        .select("*")
        .eq("ordem_servico_id", ordem.id);
      if (data && data.length > 0) {
        itens = data as unknown as ItemOS[];
      }
    } catch (err) {
      console.warn("[whatsapp] falha ao buscar itens da OS, seguindo sem lista", err);
    }
  }

  const message = formatOSMessage(ordem, oficinaNome, itens);

  const phone = manualPhone || ordem.cliente?.telefone || telefoneOficina || "";

  if (phone) {
    const link = generateWhatsAppLink(phone, message);
    window.open(link, "_blank");
  } else {
    navigator.clipboard.writeText(message);
    alert("Mensagem copiada! Cole no WhatsApp para enviar.");
  }
}


export function openWhatsAppOrcamento(
  orcamento: Orcamento,
  oficinaNome: string,
  telefoneOficina?: string | null,
  itensOrcamento: ItemOrcamento[] = [],
): void {
  const linkPublico = getPublicOrcamentoLink(orcamento);
  const message = formatOrcamentoMessage(orcamento, oficinaNome, linkPublico, itensOrcamento);
  
  const phone = orcamento.cliente?.telefone || telefoneOficina || "";
  
  if (phone) {
    const link = generateWhatsAppLink(phone, message);
    window.open(link, "_blank");
  } else {
    navigator.clipboard.writeText(message);
    alert("Mensagem copiada! Cole no WhatsApp para enviar.");
  }
}

// ── AGENDAMENTO (compartilhar confirmação de agendamento) ──

export function formatAgendamentoMessage(
  ordem: OrdemServico,
  oficinaNome: string,
): string {
  const [year, month, day] = ordem.data_servico.split("-");
  const dataFormatada = `${day}/${month}/${year}`;

  const hora = ordem.hora_agendamento
    ? ordem.hora_agendamento.slice(0, 5)
    : null;

  const lines: (string | null)[] = [
    `📅 *Confirmação de Agendamento*`,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `Olá${ordem.cliente?.nome ? ` ${ordem.cliente.nome.split(" ")[0]}` : ""}! 👋`,
    ``,
    `Seu agendamento na *${oficinaNome}* está confirmado:`,
    ``,
    `🗓️ *Data:* ${dataFormatada}`,
    hora ? `🕐 *Horário:* ${hora}` : null,
    ``,
    `🚗 *Veículo:* ${ordem.veiculo?.marca || ""} ${ordem.veiculo?.modelo || ""}`.trim(),
    ordem.veiculo?.placa ? `🔖 *Placa:* ${ordem.veiculo.placa}` : null,
    `🛠️ *Serviço:* ${ordem.tipo_servico}`,
    ordem.descricao ? `📝 *Obs:* ${ordem.descricao}` : null,
  ];

  if (ordem.valor_servico && ordem.valor_servico > 0) {
    lines.push(``);
    lines.push(`💰 *Valor estimado:* ${formatCurrency(ordem.valor_servico)}`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━`);
  lines.push(`Responda se precisar reagendar! 👍`);

  return lines.filter((l) => l !== null).join("\n");
}

export function openWhatsAppAgendamento(
  ordem: OrdemServico,
  oficinaNome: string,
): void {
  const message = formatAgendamentoMessage(ordem, oficinaNome);
  const phone = ordem.cliente?.telefone || "";

  if (phone) {
    const link = generateWhatsAppLink(phone, message);
    window.open(link, "_blank");
  } else {
    navigator.clipboard.writeText(message);
    alert("Mensagem copiada! O cliente não tem telefone cadastrado. Cole no WhatsApp para enviar.");
  }
}
