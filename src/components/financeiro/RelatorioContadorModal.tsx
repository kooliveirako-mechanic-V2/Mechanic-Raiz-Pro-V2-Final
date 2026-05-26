import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOficina } from "@/contexts/OficinaContext";
import { useOficinaConfiguracoes } from "@/hooks/useOficinaConfiguracoes";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, FileSpreadsheet, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { formatCurrency } from "@/lib/formatters";

interface RelatorioContadorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const meses = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export function RelatorioContadorModal({ open, onOpenChange }: RelatorioContadorModalProps) {
  const { oficinaAtual } = useOficina();
  const { configuracoes } = useOficinaConfiguracoes();
  
  const currentDate = new Date();
  const [mes, setMes] = useState(String(currentDate.getMonth() + 1).padStart(2, "0"));
  const [ano, setAno] = useState(String(currentDate.getFullYear()));
  const [generating, setGenerating] = useState(false);

  const anos = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2].map(y => ({
      value: String(y),
      label: String(y),
    }));
  }, []);

  // BUG 4 FIX: Query financeiro directly for the selected period instead of using useFinanceiro (which only loads 2 months)
  const dataInicio = format(startOfMonth(new Date(parseInt(ano), parseInt(mes) - 1)), "yyyy-MM-dd");
  const dataFim = format(endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1)), "yyyy-MM-dd");

  const { data: transacoesDoPeríodo = [], isLoading } = useQuery({
    queryKey: ["relatorio-contador", oficinaAtual?.id, mes, ano],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("financeiro")
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .order("data", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!oficinaAtual && open,
    staleTime: 60_000,
  });

  // Para separar peças x serviço, busca breakdown das OS vinculadas
  const osIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of transacoesDoPeríodo as any[]) {
      if (t.ordem_servico_id) s.add(t.ordem_servico_id);
    }
    return Array.from(s);
  }, [transacoesDoPeríodo]);

  // IDs dos financeiros de Venda Balcão (para classificar por itens de estoque)
  const vendaBalcaoFinIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of transacoesDoPeríodo as any[]) {
      if (!t.ordem_servico_id && t.categoria === "venda_balcao") s.add(t.id);
    }
    return Array.from(s);
  }, [transacoesDoPeríodo]);

  const { data: osBreakdown = {} } = useQuery<Record<string, { pecas: number; servico: number; total: number }>>({
    queryKey: ["relatorio-contador-os-breakdown", oficinaAtual?.id, osIds.sort().join(",")],
    enabled: !!oficinaAtual && osIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const [osRes, itensRes] = await Promise.all([
        supabase.from("ordens_servico").select("id, valor_mao_obra").in("id", osIds),
        supabase.from("itens_os").select("ordem_servico_id, tipo, quantidade, valor_unitario, valor_mao_obra").in("ordem_servico_id", osIds),
      ]);
      const itensByOS: Record<string, any[]> = {};
      for (const it of (itensRes.data as any[]) || []) {
        (itensByOS[it.ordem_servico_id] ||= []).push(it);
      }
      const map: Record<string, { pecas: number; servico: number; total: number }> = {};
      for (const os of (osRes.data as any[]) || []) {
        const itens = itensByOS[os.id] || [];
        let pecas = 0, servicoItens = 0, moItens = 0;
        for (const it of itens) {
          const qtd = Number(it.quantidade) || 0;
          const vu = Number(it.valor_unitario) || 0;
          moItens += Number(it.valor_mao_obra) || 0;
          if (it.tipo === "servico") servicoItens += qtd * vu;
          else pecas += qtd * vu;
        }
        const maoObra = Math.max(Number(os.valor_mao_obra) || 0, moItens);
        const servico = maoObra + servicoItens;
        map[os.id] = { pecas, servico, total: pecas + servico };
      }
      return map;
    },
  });

  // Breakdown de Venda Balcão: cruza itens_venda_balcao → estoque.tipo_item
  const { data: vendaBalcaoBreakdown = {} } = useQuery<Record<string, { pecas: number; servico: number; total: number }>>({
    queryKey: ["relatorio-contador-vb-breakdown", oficinaAtual?.id, vendaBalcaoFinIds.sort().join(",")],
    enabled: !!oficinaAtual && vendaBalcaoFinIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: vendas } = await supabase
        .from("vendas_balcao")
        .select("id, financeiro_id")
        .in("financeiro_id", vendaBalcaoFinIds);
      const vendaIds = (vendas || []).map((v: any) => v.id);
      if (vendaIds.length === 0) return {};
      const { data: itens } = await supabase
        .from("itens_venda_balcao")
        .select("venda_id, quantidade, valor_unitario, estoque_id, estoque:estoque_id(tipo_item)")
        .in("venda_id", vendaIds);

      const byVenda: Record<string, { pecas: number; servico: number }> = {};
      for (const it of (itens as any[]) || []) {
        const v = (byVenda[it.venda_id] ||= { pecas: 0, servico: 0 });
        const total = (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0);
        const tipo = it.estoque?.tipo_item;
        if (tipo === "servico") v.servico += total;
        else if (tipo === "peca") v.pecas += total;
        else v.pecas += total; // venda balcão sem estoque → assume peça (uso típico)
      }
      const map: Record<string, { pecas: number; servico: number; total: number }> = {};
      for (const v of (vendas as any[]) || []) {
        const b = byVenda[v.id] || { pecas: 0, servico: 0 };
        map[v.financeiro_id] = { pecas: b.pecas, servico: b.servico, total: b.pecas + b.servico };
      }
      return map;
    },
  });

  // Classifica cada lançamento (prorrateio por OS / Venda Balcão quando possível)
  const transacoesClassificadas = useMemo(() => {
    return (transacoesDoPeríodo as any[]).map((t) => {
      let valorPecas = 0;
      let valorServico = 0;
      const valor = Number(t.valor) || 0;
      if (t.tipo === "entrada") {
        let bd: { pecas: number; servico: number; total: number } | null = null;
        if (t.ordem_servico_id) {
          bd = (osBreakdown as any)[t.ordem_servico_id] || null;
        } else if (t.categoria === "venda_balcao") {
          bd = (vendaBalcaoBreakdown as any)[t.id] || null;
        }
        if (bd && bd.total > 0) {
          valorPecas = +(valor * (bd.pecas / bd.total)).toFixed(2);
          valorServico = +(valor - valorPecas).toFixed(2);
        } else {
          // Sem vínculo (lançamento manual) → assume serviço
          valorServico = valor;
        }
      }
      return { ...t, _pecas: valorPecas, _servico: valorServico };
    });
  }, [transacoesDoPeríodo, osBreakdown, vendaBalcaoBreakdown]);

  // Calcular totais
  const totais = useMemo(() => {
    return transacoesClassificadas.reduce(
      (acc, t: any) => {
        const isPrej = t.categoria === "prejuizo";
        return {
          entradas: acc.entradas + (t.tipo === "entrada" ? Number(t.valor) : 0),
          saidas: acc.saidas + (t.tipo === "saida" ? Number(t.valor) : 0),
          prejuizos: acc.prejuizos + (t.tipo === "saida" && isPrej ? Number(t.valor) : 0),
          pecas: acc.pecas + (t._pecas || 0),
          servico: acc.servico + (t._servico || 0),
        };
      },
      { entradas: 0, saidas: 0, prejuizos: 0, pecas: 0, servico: 0 }
    );
  }, [transacoesClassificadas]);

  const mesLabel = meses.find(m => m.value === mes)?.label || mes;

  // Gerar CSV com dados completos para o contador
  const gerarCSV = () => {
    setGenerating(true);

    try {
      const headers = [
        "Data",
        "Tipo",
        "Categoria",
        "Descrição",
        "Valor Total (R$)",
        "Valor Peças (R$)",
        "Valor Serviço/MO (R$)",
        "Status",
        "Classificação",
        "OS Vinculada",
        "Tipo Origem",
      ];

      const fmt = (n: number) => n.toFixed(2).replace(".", ",");

      const formatarData = (d: string) => {
        if (!d) return "";
        // yyyy-MM-dd → dd/MM/yyyy (sem timezone shift)
        const [y, m, day] = d.split("T")[0].split("-");
        return `${day}/${m}/${y}`;
      };

      const rows = transacoesClassificadas.map((t: any) => [
        formatarData(t.data),
        t.tipo === "entrada" ? "Entrada" : "Saída",
        (t.origem || "").replace(/;/g, ","),
        (t.descricao || "").replace(/;/g, ","),
        (t.tipo === "saida" ? "-" : "") + fmt(Number(t.valor) || 0),
        t.tipo === "entrada" ? fmt(t._pecas || 0) : "",
        t.tipo === "entrada" ? fmt(t._servico || 0) : "",
        t.status || "pago",
        t.classificacao || "empresa",
        t.ordem_servico_id ? "Sim" : "Não",
        t.ordem_servico_id ? "OS" : (t.categoria === "venda_balcao" ? "Venda Balcão" : "Manual"),
      ]);

      // Linha de totais com separação fiscal
      const impostoServico = totais.servico * 0.06;
      const impostoPecas = totais.pecas * 0.04;
      rows.push([]);
      rows.push(["TOTAIS", "", "", "Total Entradas", fmt(totais.entradas), fmt(totais.pecas), fmt(totais.servico), "", "", "", ""]);
      rows.push(["", "", "", "Total Saídas", "-" + fmt(totais.saidas), "", "", "", "", "", ""]);
      rows.push(["", "", "", "Lucro Líquido", fmt(totais.entradas - totais.saidas), "", "", "", "", "", ""]);
      rows.push([]);
      rows.push(["IMPOSTOS ESTIMADOS", "", "", "ISS sobre Serviço (6%)", fmt(impostoServico), "", "", "", "", "", ""]);
      rows.push(["", "", "", "ICMS sobre Peças (4%)", fmt(impostoPecas), "", "", "", "", "", ""]);
      rows.push(["", "", "", "Total Impostos", fmt(impostoServico + impostoPecas), "", "", "", "", "", ""]);

      const csvContent = [
        `Relatório Financeiro para Contador - ${mesLabel}/${ano}`,
        `Oficina: ${(configuracoes as any)?.razao_social || oficinaAtual?.nome || ""}`,
        `CNPJ: ${(configuracoes as any)?.cnpj || "Não informado"}`,
        `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
        "",
        headers.join(";"),
        ...rows.map(row => row.join(";")),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio_contador_${mes}_${ano}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Relatório gerado!", { 
        description: `${transacoesDoPeríodo.length} lançamentos exportados` 
      });
    } catch (error) {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  };

  // Gerar texto para WhatsApp
  const gerarTextoWhatsApp = () => {
    const despesasOperacionais = totais.saidas - totais.prejuizos;
    const lucro = totais.entradas - totais.saidas;
    const impostoServico = totais.servico * 0.06;
    const impostoPecas = totais.pecas * 0.04;
    const linhas = [
      `📊 *RELATÓRIO FINANCEIRO MENSAL*`,
      `📅 Período: ${mesLabel}/${ano}`,
      ``,
      `🏢 *${(configuracoes as any)?.razao_social || oficinaAtual?.nome || "Oficina"}*`,
      `CNPJ: ${(configuracoes as any)?.cnpj || "Não informado"}`,
      ``,
      `📋 *RESUMO:*`,
      `• Total de lançamentos: ${transacoesDoPeríodo.length}`,
      `• 💰 Entradas: R$ ${totais.entradas.toFixed(2).replace(".", ",")}`,
      `   ↳ 🔧 Serviço/Mão de obra: R$ ${totais.servico.toFixed(2).replace(".", ",")}`,
      `   ↳ 📦 Peças/Produtos: R$ ${totais.pecas.toFixed(2).replace(".", ",")}`,
      `• 💸 Despesas operacionais: R$ ${despesasOperacionais.toFixed(2).replace(".", ",")}`,
    ];
    if (totais.prejuizos > 0) {
      linhas.push(`• ⚠️ Prejuízos/Retrabalho: R$ ${totais.prejuizos.toFixed(2).replace(".", ",")}`);
    }
    linhas.push(
      `• ${lucro >= 0 ? "📈" : "📉"} Resultado: R$ ${lucro.toFixed(2).replace(".", ",")}`,
      ``,
      `🧾 *IMPOSTOS ESTIMADOS:*`,
      `• ISS Serviço (6%): R$ ${impostoServico.toFixed(2).replace(".", ",")}`,
      `• ICMS Peças (4%): R$ ${impostoPecas.toFixed(2).replace(".", ",")}`,
      `• Total: R$ ${(impostoServico + impostoPecas).toFixed(2).replace(".", ",")}`,
      ``,
      `_Relatório gerado pelo sistema de gestão._`,
      `_Confirme as alíquotas com seu contador._`,
    );
    const texto = linhas.join("\n");

    navigator.clipboard.writeText(texto);
    toast.success("Texto copiado!", {
      description: "Cole no WhatsApp para enviar ao contador",
    });
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Relatório para Contador
          </DialogTitle>
          <DialogDescription>
            Dados financeiros completos com classificação e categorias
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Seleção de período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anos.map(a => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">Prévia do Relatório</h4>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Período:</span>
                  <span className="font-medium">{mesLabel}/{ano}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lançamentos:</span>
                  <span className="font-medium">{transacoesDoPeríodo.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entradas:</span>
                  <span className="font-bold text-success">
                    {formatCurrency(totais.entradas)}
                  </span>
                </div>
                <div className="flex justify-between pl-3 text-xs">
                  <span className="text-muted-foreground">🔧 Serviço/Mão de obra:</span>
                  <span className="font-semibold">{formatCurrency(totais.servico)}</span>
                </div>
                <div className="flex justify-between pl-3 text-xs">
                  <span className="text-muted-foreground">📦 Peças/Produtos:</span>
                  <span className="font-semibold">{formatCurrency(totais.pecas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saídas:</span>
                  <span className="font-bold text-destructive">
                    {formatCurrency(totais.saidas)}
                  </span>
                </div>
                {totais.prejuizos > 0 && (
                  <div className="flex justify-between pl-3">
                    <span className="text-destructive/80">⚠️ Prejuízos/Retrabalho:</span>
                    <span className="font-semibold text-destructive">
                      {formatCurrency(totais.prejuizos)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">Resultado:</span>
                  <span className="font-bold text-accent">
                    {formatCurrency(totais.entradas - totais.saidas)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-1 space-y-1">
                  <div className="text-xs font-semibold text-muted-foreground">🧾 Impostos estimados</div>
                  <div className="flex justify-between text-xs pl-3">
                    <span className="text-muted-foreground">ISS Serviço (6%):</span>
                    <span className="font-semibold">{formatCurrency(totais.servico * 0.06)}</span>
                  </div>
                  <div className="flex justify-between text-xs pl-3">
                    <span className="text-muted-foreground">ICMS Peças (4%):</span>
                    <span className="font-semibold">{formatCurrency(totais.pecas * 0.04)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-xs text-info">
            💡 Separa <strong>peças (4%)</strong> e <strong>serviço/mão de obra (6%)</strong> automaticamente:
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li><strong>OS:</strong> divide pelos itens cadastrados (peça/serviço/mão de obra).</li>
              <li><strong>Venda Balcão:</strong> classifica cada item pelo tipo no estoque (peça/serviço).</li>
              <li><strong>Lançamento manual sem vínculo:</strong> entra como serviço.</li>
            </ul>
          </div>


          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={gerarCSV}
              className="w-full h-11 bg-accent hover:bg-accent/90"
              disabled={generating || transacoesDoPeríodo.length === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Baixar CSV
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={gerarTextoWhatsApp}
              className="w-full h-11"
              disabled={transacoesDoPeríodo.length === 0}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Copiar Resumo para WhatsApp
            </Button>
          </div>

          {transacoesDoPeríodo.length === 0 && !isLoading && (
            <p className="text-center text-sm text-muted-foreground">
              Nenhum lançamento financeiro neste período
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
