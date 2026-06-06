import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOficina } from "@/contexts/OficinaContext";
import { useOficinaConfiguracoes } from "@/hooks/useOficinaConfiguracoes";
import { FileText, Loader2, FileSpreadsheet, MessageCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import { useFinanceiroPreFiscalUnificado } from "@/hooks/useFinanceiroPreFiscalUnificado";

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

  const dataInicio = format(startOfMonth(new Date(parseInt(ano), parseInt(mes) - 1)), "yyyy-MM-dd");
  const dataFim = format(endOfMonth(new Date(parseInt(ano), parseInt(mes) - 1)), "yyyy-MM-dd");

  const { data: preFiscal, isLoading } = useFinanceiroPreFiscalUnificado(dataInicio, dataFim);

  const transacoesClassificadas = useMemo(() => {
    return (preFiscal?.analitico || []).map((t: any) => ({
      ...t,
      data: t.data_competencia,
      valor: t.valor_liquido,
      _pecas: 0,
      _servico: 0
    }));
  }, [preFiscal]);

  const totais = useMemo(() => {
    if (!preFiscal) return { entradas: 0, saidas: 0, prejuizos: 0, pecas: 0, servico: 0 };
    return {
      entradas: preFiscal.metrics.caixa.entradas,
      saidas: preFiscal.metrics.caixa.saidas,
      prejuizos: 0,
      pecas: 0,
      servico: 0
    };
  }, [preFiscal]);

  const mesLabel = meses.find(m => m.value === mes)?.label || mes;

  const gerarCSV = () => {
    if (!preFiscal || preFiscal.analitico.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    setGenerating(true);

    try {
      let csvContent = "\ufeff";
      
      // Alerta de Histórico no CSV
      if (preFiscal.ressalvas.tem_ressalva) {
        csvContent += `ALERTA: Este relatório possui dados históricos com custo pendente de normalização estimada. O lucro operacional histórico pode estar inflado em aproximadamente R$ ${formatCurrency(preFiscal.ressalvas.impacto_estimado)} nos períodos afetados.\n\n`;
      }

      csvContent += `Relatório Financeiro para Contador - ${mesLabel}/${ano}\n`;
      csvContent += `Oficina: ${(configuracoes as any)?.razao_social || oficinaAtual?.nome || ""}\n`;
      csvContent += `CNPJ: ${(configuracoes as any)?.cnpj || "Não informado"}\n`;
      csvContent += `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;

      const headers = [
        "Data Competência",
        "Data Pagamento",
        "Tipo",
        "Categoria",
        "Descrição",
        "Valor Bruto",
        "Desconto",
        "Valor Líquido",
        "Status",
        "Documento",
        "Obs. Contador",
        "Ressalva Histórica"
      ];

      csvContent += headers.join(";") + "\n";

      preFiscal.analitico.forEach((r: any) => {
        const row = [
          format(parseISO(r.data_competencia), "dd/MM/yyyy"),
          r.data_pagamento ? format(parseISO(r.data_pagamento), "dd/MM/yyyy") : "",
          r.tipo === "entrada" ? "Entrada" : "Saída",
          (r.categoria || "").replace(/;/g, ","),
          (r.descricao || "").replace(/;/g, ","),
          Number(r.valor_bruto).toFixed(2).replace(".", ","),
          "0,00",
          Number(r.valor_liquido).toFixed(2).replace(".", ","),
          r.status,
          r.numero_documento || "",
          (r.observacoes_contador || "").replace(/;/g, ","),
          preFiscal.ressalvas.tem_ressalva ? "Sim" : "Não"
        ];
        csvContent += row.join(";") + "\n";
      });

      csvContent += "\n";
      csvContent += `;;;RESUMO CAIXA (PAGOS)\n`;
      csvContent += `;;;Entradas;;${Number(preFiscal.metrics.caixa.entradas).toFixed(2).replace(".", ",")}\n`;
      csvContent += `;;;Saídas;;${Number(preFiscal.metrics.caixa.saidas).toFixed(2).replace(".", ",")}\n`;
      csvContent += `;;;Saldo Caixa;;${Number(preFiscal.metrics.caixa.entradas - preFiscal.metrics.caixa.saidas).toFixed(2).replace(".", ",")}\n\n`;

      csvContent += `;;;RESUMO COMPETÊNCIA (FINALIZADOS)\n`;
      csvContent += `;;;Faturamento Bruto;;${Number(preFiscal.metrics.competencia.faturamento_bruto).toFixed(2).replace(".", ",")}\n`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio_contador_${mes}_${ano}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Relatório gerado!", { 
        description: `${preFiscal.analitico.length} lançamentos exportados` 
      });
    } catch (error) {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  };

  const gerarTextoWhatsApp = () => {
    if (!preFiscal) return;
    const lucro = preFiscal.metrics.caixa.entradas - preFiscal.metrics.caixa.saidas;
    const linhas = [
      `📊 *RELATÓRIO FINANCEIRO MENSAL*`,
      `📅 Período: ${mesLabel}/${ano}`,
      ``,
      `🏢 *${(configuracoes as any)?.razao_social || oficinaAtual?.nome || "Oficina"}*`,
      `CNPJ: ${(configuracoes as any)?.cnpj || "Não informado"}`,
      ``,
      `📋 *RESUMO CAIXA:*`,
      `• Total de lançamentos: ${preFiscal.analitico.length}`,
      `• 💰 Entradas: R$ ${preFiscal.metrics.caixa.entradas.toFixed(2).replace(".", ",")}`,
      `• 💸 Saídas: R$ ${preFiscal.metrics.caixa.saidas.toFixed(2).replace(".", ",")}`,
      `• ${lucro >= 0 ? "📈" : "📉"} Saldo: R$ ${lucro.toFixed(2).replace(".", ",")}`,
      ``,
      `📋 *COMPETÊNCIA:*`,
      `• Faturamento Bruto: R$ ${preFiscal.metrics.competencia.faturamento_bruto.toFixed(2).replace(".", ",")}`,
    ];

    if (preFiscal.ressalvas.tem_ressalva) {
      linhas.push(``, `⚠️ *RESSALVA HISTÓRICA:*`, `Este relatório possui dados com custo pendente. Impacto estimado: R$ ${preFiscal.ressalvas.impacto_estimado.toFixed(2).replace(".", ",")}`);
    }

    linhas.push(``, `_Relatório gerado pelo sistema de gestão._`);
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
            Dados financeiros oficiais da Fonte Única (RPC)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
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
                  <span className="font-medium">{preFiscal?.analitico.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-success">Entradas Caixa:</span>
                  <span className="font-bold text-success">
                    {formatCurrency(preFiscal?.metrics.caixa.entradas || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-destructive">Saídas Caixa:</span>
                  <span className="font-bold text-destructive">
                    {formatCurrency(preFiscal?.metrics.caixa.saidas || 0)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Fat. Competência:</span>
                  <span>{formatCurrency(preFiscal?.metrics.competencia.faturamento_bruto || 0)}</span>
                </div>
              </div>
            )}
          </div>

          {preFiscal?.ressalvas.tem_ressalva && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Este relatório possui dados históricos com custo pendente. O lucro operacional pode estar inflado em ~R$ {formatCurrency(preFiscal.ressalvas.impacto_estimado)}.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={gerarCSV}
              className="w-full h-11 bg-accent hover:bg-accent/90"
              disabled={generating || !preFiscal || preFiscal.analitico.length === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Baixar CSV (Contador)
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={gerarTextoWhatsApp}
              className="w-full h-11"
              disabled={!preFiscal || preFiscal.analitico.length === 0}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Copiar Resumo para WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
