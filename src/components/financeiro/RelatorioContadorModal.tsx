import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOficina } from "@/contexts/OficinaContext";
import { useOficinaConfiguracoes } from "@/hooks/useOficinaConfiguracoes";
import { FileText, Loader2, FileSpreadsheet, MessageCircle, AlertTriangle, FileDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { useFinanceiroPreFiscalUnificado } from "@/hooks/useFinanceiroPreFiscalUnificado";
import { getUnifiedMetrics } from "@/services/financeiroService";
import { useFinanceiroPreFiscalV2 } from "@/hooks/useFinanceiroPreFiscalV2";
import { Badge } from "@/components/ui/badge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// FEATURE FLAG: FINANCEIRO_V2_PREFISCAL_ENABLED
export const FINANCEIRO_V2_PREFISCAL_ENABLED = false;

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

  const isV2 = FINANCEIRO_V2_PREFISCAL_ENABLED;

  // Hooks
  const { data: preFiscalV2, isLoading: isLoadingV2 } = useFinanceiroPreFiscalV2(dataInicio, dataFim);
  const { data: preFiscalLegado, isLoading: isLoadingLegado } = useFinanceiroPreFiscalUnificado(dataInicio, dataFim);

  const isLoading = isV2 ? isLoadingV2 : isLoadingLegado;

  // Mapeamento normalizado para evitar erros de propriedade em tempo de execução
  const normalizedData = useMemo(() => {
    if (isV2 && preFiscalV2) {
      return {
        competencia: {
          faturamentoBruto: preFiscalV2.competencia.faturamento_liquido,
          descontos: preFiscalV2.competencia.recebido_vinculado_competencia,
          faturamentoLiquido: preFiscalV2.competencia.faturamento_liquido,
          cmvTotal: preFiscalV2.custos.cmv_total,
          lucroOperacional: preFiscalV2.resultado.lucro_operacional,
          saldoAReceber: preFiscalV2.competencia.saldo_a_receber_competencia
        },
        caixa: {
          entradasPagas: preFiscalV2.caixa.entradas_pagas_no_periodo,
          saidasPagas: preFiscalV2.caixa.saidas_pagas_no_periodo,
          lucroCaixa: preFiscalV2.caixa.saldo_caixa_periodo
        },
        analitico: [
          ...preFiscalV2.auditoria.registros_os.map(os => ({
            data_competencia: os.data_competencia_usada,
            data_pagamento: os.pago ? os.data_competencia_usada : null,
            tipo: 'entrada',
            categoria: 'Serviço/OS',
            descricao: `OS #${os.numero}`,
            valor_bruto: os.valor_bruto,
            valor_liquido: os.valor_liquido,
            status: os.status,
            is_teste: os.is_teste,
            numero_documento: '',
            observacoes_contador: ''
          })),
          ...preFiscalV2.auditoria.registros_vendas.map(v => ({
            data_competencia: v.data_competencia_usada,
            data_pagamento: v.pago ? v.data_competencia_usada : null,
            tipo: 'entrada',
            categoria: 'Venda Balcão',
            descricao: `Venda #${v.numero}`,
            valor_bruto: v.valor_bruto,
            valor_liquido: v.valor_liquido,
            status: v.status,
            is_teste: v.is_teste,
            numero_documento: '',
            observacoes_contador: ''
          }))
        ],
        alertas: {
          historicoComRessalva: false,
          itensSemCusto: 0
        }
      };
    }
    
    if (preFiscalLegado) {
      return {
        competencia: {
          faturamentoBruto: preFiscalLegado.competencia.faturamentoBruto,
          descontos: preFiscalLegado.competencia.descontos,
          faturamentoLiquido: preFiscalLegado.competencia.faturamentoLiquido,
          cmvTotal: preFiscalLegado.custos.cmvTotal,
          lucroOperacional: preFiscalLegado.resultado.lucroOperacional,
          saldoAReceber: preFiscalLegado.competencia.saldoAReceber
        },
        caixa: {
          entradasPagas: preFiscalLegado.caixa.entradasPagas,
          saidasPagas: preFiscalLegado.caixa.saidasPagas,
          lucroCaixa: preFiscalLegado.caixa.lucroCaixa
        },
        analitico: preFiscalLegado.analitico,
        alertas: preFiscalLegado.alertas
      };
    }

    return null;
  }, [isV2, preFiscalV2, preFiscalLegado]);

  const mesLabel = meses.find(m => m.value === mes)?.label || mes;

  const gerarCSV = () => {
    if (!normalizedData || normalizedData.analitico.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    setGenerating(true);

    try {
      let csvContent = "\ufeff";
      
      if (isV2) {
        csvContent += `AVISO: Pré-fiscal V2 gerado com base nos dados atuais. Limpeza de testes e backfill histórico continuam pendentes.\n\n`;
      } else if (normalizedData.alertas.historicoComRessalva) {
        csvContent += `ALERTA: Este relatório possui dados históricos com custo pendente de normalização estimada.\n\n`;
      }

      csvContent += `Relatório Financeiro para Contador - ${mesLabel}/${ano}\n`;
      csvContent += `Oficina: ${(configuracoes as any)?.razao_social || oficinaAtual?.nome || ""}\n`;
      csvContent += `CNPJ: ${(configuracoes as any)?.cnpj || "Não informado"}\n`;
      csvContent += `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;

      const headers = ["Data Competência", "Data Pagamento", "Tipo", "Categoria", "Descrição", "Valor Bruto", "Valor Líquido", "Status"];
      csvContent += headers.join(";") + "\n";

      normalizedData.analitico.forEach((r: any) => {
        const row = [
          format(parseISO(r.data_competencia), "dd/MM/yyyy"),
          r.data_pagamento ? format(parseISO(r.data_pagamento), "dd/MM/yyyy") : "",
          r.tipo === "entrada" ? "Entrada" : "Saída",
          (r.categoria || ""),
          (r.descricao || ""),
          Number(r.valor_bruto).toFixed(2).replace(".", ","),
          Number(r.valor_liquido).toFixed(2).replace(".", ","),
          r.status
        ];
        csvContent += row.join(";") + "\n";
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio_contador_${mes}_${ano}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Relatório gerado!");
    } catch (error) {
      toast.error("Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  };

  const gerarPDF = () => {
    if (!normalizedData || normalizedData.analitico.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório Financeiro Pré-Fiscal", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Oficina: ${(configuracoes as any)?.razao_social || oficinaAtual?.nome || ""}`, 20, 30);
      doc.text(`Período: ${mesLabel}/${ano}`, 20, 35);

      if (isV2) {
        doc.setFontSize(8);
        doc.text("Pré-fiscal V2 gerado com base nos dados atuais. Limpeza pendente.", 20, 42);
      }

      autoTable(doc, {
        startY: 50,
        head: [["Data", "Tipo", "Categoria", "Descrição", "Valor Líq.", "Status"]],
        body: normalizedData.analitico.map((r: any) => [
          format(parseISO(r.data_competencia), "dd/MM/yyyy"),
          r.tipo === "entrada" ? "Entrada" : "Saída",
          r.categoria,
          r.descricao || "",
          formatCurrency(r.valor_liquido),
          r.status
        ]),
        theme: "striped",
        headStyles: { fillColor: [40, 40, 40] },
        styles: { fontSize: 8 },
      });

      doc.save(`relatorio_contador_${mes}_${ano}.pdf`);
      toast.success("PDF gerado!");
    } catch (error) {
      toast.error("Erro ao gerar PDF");
    } finally {
      setGenerating(false);
    }
  };

  const gerarTextoWhatsApp = () => {
    if (!normalizedData) return;
    const linhas = [
      `📊 *RELATÓRIO FINANCEIRO MENSAL (PRÉ-FISCAL)*`,
      `📅 Período: ${mesLabel}/${ano}`,
      ``,
      `📋 *RESUMO COMPETÊNCIA:*`,
      `• Faturamento Líquido: ${formatCurrency(normalizedData.competencia.faturamentoLiquido)}`,
      `• Lucro Operacional: ${formatCurrency(normalizedData.competencia.lucroOperacional)}`,
      ``,
      `📋 *RESUMO CAIXA:*`,
      `• Entradas: ${formatCurrency(normalizedData.caixa.entradasPagas)}`,
      `• Saldo Caixa: ${formatCurrency(normalizedData.caixa.lucroCaixa)}`,
      ``,
      `_Documento pré-fiscal para conferência. Não substitui escrituração contábil._`
    ];

    navigator.clipboard.writeText(linhas.join("\n"));
    toast.success("Texto copiado!");
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
            {isV2 ? "Pré-fiscal V2 (Apoio ao Contador)" : "Dados financeiros oficiais (Competência e Caixa)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isV2 && (
            <Badge variant="outline" className="w-full border-primary/20 bg-primary/5 text-primary py-2 px-3">
              <Info className="w-4 h-4 mr-2" /> Modo Auditoria V2 Ativo
            </Badge>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {meses.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map(a => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">Resumo do Período</h4>
            {isLoading ? (
              <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : !normalizedData ? (
              <p className="text-sm text-muted-foreground">Nenhum dado encontrado</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2">Competência (Finalizados)</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Faturamento Líquido:</span>
                      <span className="font-bold">{formatCurrency(normalizedData.competencia.faturamentoLiquido)}</span>
                    </div>
                    <div className="flex justify-between text-success">
                      <span>Lucro Operacional:</span>
                      <span className="font-bold">{formatCurrency(normalizedData.competencia.lucroOperacional)}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold mb-2">Caixa (Pagos no Mês)</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-success">
                      <span>Entradas Totais:</span>
                      <span>{formatCurrency(normalizedData.caixa.entradasPagas)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-1">
                      <span>Saldo de Caixa:</span>
                      <span className={normalizedData.caixa.lucroCaixa >= 0 ? "text-success" : "text-destructive"}>
                        {formatCurrency(normalizedData.caixa.lucroCaixa)}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic pt-2 border-t">
                   {isV2 ? "V2: Pré-fiscal para conferência. Não substitui escrituração." : "Legado: Dados sujeitos a confirmação."}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" onClick={gerarCSV} disabled={generating || isLoading}>
              <FileSpreadsheet className="w-4 h-4" /> CSV
            </Button>
            <Button variant="outline" className="gap-2" onClick={gerarPDF} disabled={generating || isLoading}>
              <FileDown className="w-4 h-4" /> PDF
            </Button>
            <Button className="col-span-2 gap-2 bg-success hover:bg-success/90" onClick={gerarTextoWhatsApp} disabled={isLoading}>
              <MessageCircle className="w-4 h-4" /> Copiar para WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
