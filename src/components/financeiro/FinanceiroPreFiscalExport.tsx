import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Loader2, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { useFinanceiroPreFiscalUnificado } from "@/hooks/useFinanceiroPreFiscalUnificado";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";

interface FinanceiroPreFiscalExportProps {
  dateRange: { start: string; end: string };
}

export function FinanceiroPreFiscalExport({ dateRange }: FinanceiroPreFiscalExportProps) {
  const [exporting, setExporting] = useState(false);
  const { data: preFiscal, isLoading } = useFinanceiroPreFiscalUnificado(dateRange.start, dateRange.end);

  const formatCurrencyValue = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const escapeCSV = (value: string | null | undefined) => {
    if (!value) return "";
    const escaped = String(value).replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const handleExportCSV = async (tipo: "contador") => {
    if (!preFiscal || preFiscal.analitico.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }

    setExporting(true);
    try {
      let csvContent = "\uFEFF"; // BOM for Excel
      let filename = "relatorio_contador";

      if (tipo === "contador") {
        // Alerta de Histórico no CSV
        if (preFiscal.alertas.historicoComRessalva) {
          csvContent += `ALERTA: Este relatório possui dados históricos com custo pendente de normalização estimada. O lucro operacional histórico pode estar inflado em aproximadamente R$ ${formatCurrencyValue(preFiscal.alertas.itensSemCusto)} nos períodos afetados.\n\n`;
        }

        csvContent += "Data Competência,Data Pagamento,Tipo,Categoria,Descrição,Valor Bruto,Desconto,Valor Líquido,Status,Documento,Ressalva Histórica\n";
        
        preFiscal.analitico.forEach((r) => {
          const row = [
            format(parseISO(r.data_competencia), "dd/MM/yyyy"),
            r.data_pagamento ? format(parseISO(r.data_pagamento), "dd/MM/yyyy") : "",
            r.tipo === "entrada" ? "Receita" : "Despesa",
            escapeCSV(r.categoria),
            escapeCSV(r.descricao),
            formatCurrencyValue(Number(r.valor_bruto)),
            formatCurrencyValue(Number(r.desconto)),
            formatCurrencyValue(Number(r.valor_liquido)),
            escapeCSV(r.status),
            escapeCSV(r.numero_documento),
            preFiscal.alertas.historicoComRessalva ? "Sim" : "Não"
          ];
          csvContent += row.join(",") + "\n";
        });

        // Totais Oficiais da RPC (Fonte Única)
        csvContent += "\n";
        csvContent += `,,RESUMO CAIXA (PAGOS)\n`;
        csvContent += `,,Entradas,,${formatCurrencyValue(preFiscal.caixa.entradasPagas)}\n`;
        csvContent += `,,Saídas,,${formatCurrencyValue(preFiscal.caixa.saidasPagas)}\n`;
        csvContent += `,,Lucro Caixa,,${formatCurrencyValue(preFiscal.caixa.lucroCaixa)}\n\n`;

        csvContent += `,,RESUMO COMPETÊNCIA (FINALIZADOS)\n`;
        csvContent += `,,Faturamento Bruto,,${formatCurrencyValue(preFiscal.competencia.faturamentoBruto)}\n`;
        csvContent += `,,Descontos,,${formatCurrencyValue(preFiscal.competencia.descontos)}\n`;
        csvContent += `,,Faturamento Líquido,,${formatCurrencyValue(preFiscal.competencia.faturamentoLiquido)}\n`;
        csvContent += `,,Peças Bruto,,${formatCurrencyValue(preFiscal.competencia.pecasBruto)}\n`;
        csvContent += `,,Serviços Bruto,,${formatCurrencyValue(preFiscal.competencia.servicosBruto)}\n`;
        csvContent += `,,Venda Balcão Bruto,,${formatCurrencyValue(preFiscal.competencia.vendaBalcaoBruto)}\n`;
        csvContent += `,,CMV Total,,${formatCurrencyValue(preFiscal.custos.cmvTotal)}\n`;
        csvContent += `,,Lucro Operacional,,${formatCurrencyValue(preFiscal.resultado.lucroOperacional)}\n`;
        csvContent += `,,Saldo a Receber,,${formatCurrencyValue(preFiscal.competencia.saldoAReceber)}\n`;
      }

      if (dateRange) {
        filename += `_${format(parseISO(dateRange.start), "ddMMyyyy")}_${format(parseISO(dateRange.end), "ddMMyyyy")}`;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Relatório exportado!", { description: `${filename}.csv` });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar relatório");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {preFiscal?.alertas.historicoComRessalva && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs mb-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Este relatório possui dados históricos com custo pendente. O lucro operacional pode estar inflado em ~R$ {formatCurrencyValue(preFiscal.alertas.itensSemCusto)}.
          </p>
        </div>
      )}

      {FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED && (preFiscal as any)?.modo === "preview_limpeza_logica" && (
        <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/30 rounded-md text-info text-xs mb-2">
          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Modo V2 Limpo Ativo</p>
            <p>
              Registros de teste ignorados por manifesto ({ (preFiscal as any).auditoria?.registros_ignorados_por_manifesto?.length || 0} itens).
            </p>
          </div>
        </div>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={exporting || isLoading} className="border-primary/20 hover:bg-primary/5">
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Exportar Pré-Fiscal
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => handleExportCSV("contador")}>
            <FileText className="w-4 h-4 mr-2 text-primary" />
            <div className="flex flex-col">
              <span className="font-medium">Para Contador</span>
              <span className="text-xs text-muted-foreground">Fonte Única (RPC)</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
