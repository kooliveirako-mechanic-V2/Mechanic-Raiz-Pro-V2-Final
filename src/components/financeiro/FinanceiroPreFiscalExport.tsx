import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFinanceiroPreFiscalUnificado } from "@/hooks/useFinanceiroPreFiscalUnificado";

interface FinanceiroPreFiscalExportProps {
  dateRange: { start: string; end: string };
}

export function FinanceiroPreFiscalExport({ dateRange }: FinanceiroPreFiscalExportProps) {
  const [exporting, setExporting] = useState(false);
  const { data: preFiscal, isLoading } = useFinanceiroPreFiscalUnificado(dateRange.start, dateRange.end);

  const formatCurrency = (value: number) => {
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
        if (preFiscal.ressalvas.tem_ressalva) {
          csvContent += `ALERTA: Este relatório possui dados históricos com custo pendente de normalização estimada. O lucro operacional histórico pode estar inflado em aproximadamente R$ ${formatCurrency(preFiscal.ressalvas.impacto_estimado)} nos períodos afetados.\n\n`;
        }

        csvContent += "Data Competência,Data Pagamento,Tipo,Categoria,Descrição,Valor Bruto,Desconto,Valor Líquido,Status,Documento,Obs. Contador,Dado Estimado,Ressalva Histórica\n";
        
        preFiscal.analitico.forEach((r) => {
          const row = [
            format(parseISO(r.data_competencia), "dd/MM/yyyy"),
            r.data_pagamento ? format(parseISO(r.data_pagamento), "dd/MM/yyyy") : "",
            r.tipo === "entrada" ? "Receita" : "Despesa",
            escapeCSV(r.categoria),
            escapeCSV(r.descricao),
            formatCurrency(Number(r.valor_bruto)),
            formatCurrency(Number(r.desconto)),
            formatCurrency(Number(r.valor_liquido)),
            escapeCSV(r.status),
            escapeCSV(r.numero_documento),
            escapeCSV(r.observacoes_contador),
            r.is_estimado ? "Sim" : "Não",
            preFiscal.ressalvas.tem_ressalva ? "Sim" : "Não"
          ];
          csvContent += row.join(",") + "\n";
        });

        // Totais Oficiais da RPC (Fonte Única)
        csvContent += "\n";
        csvContent += `,,RESUMO CAIXA (PAGOS)\n`;
        csvContent += `,,Entradas,,${formatCurrency(preFiscal.metrics.caixa.entradas)}\n`;
        csvContent += `,,Saídas,,${formatCurrency(preFiscal.metrics.caixa.saidas)}\n`;
        csvContent += `,,Lucro Caixa,,${formatCurrency(preFiscal.metrics.caixa.lucro_caixa)}\n\n`;

        csvContent += `,,RESUMO COMPETÊNCIA (FINALIZADOS)\n`;
        csvContent += `,,Faturamento Bruto,,${formatCurrency(preFiscal.metrics.competencia.faturamento_bruto)}\n`;
        csvContent += `,,Descontos,,${formatCurrency(preFiscal.metrics.competencia.descontos)}\n`;
        csvContent += `,,Faturamento Líquido,,${formatCurrency(preFiscal.metrics.competencia.faturamento_liquido)}\n`;
        csvContent += `,,Peças Líquido,,${formatCurrency(preFiscal.metrics.competencia.pecas_liquido)}\n`;
        csvContent += `,,Serviços Líquido,,${formatCurrency(preFiscal.metrics.competencia.servicos_liquido)}\n`;
        csvContent += `,,CMV,,${formatCurrency(preFiscal.metrics.competencia.cmv)}\n`;
        csvContent += `,,Lucro Operacional,,${formatCurrency(preFiscal.metrics.competencia.lucro_operacional)}\n`;
        csvContent += `,,Saldo a Receber,,${formatCurrency(preFiscal.metrics.competencia.saldo_a_receber)}\n`;
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
      {preFiscal?.ressalvas.tem_ressalva && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs mb-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Este relatório possui dados históricos com custo pendente. O lucro operacional pode estar inflado em ~R$ {formatCurrency(preFiscal.ressalvas.impacto_estimado)}.
          </p>
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
