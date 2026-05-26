import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FinanceiroPreFiscal } from "@/hooks/useFinanceiroPreFiscal";

interface FinanceiroPreFiscalExportProps {
  registros: FinanceiroPreFiscal[];
  dateRange?: { start: string; end: string } | null;
}

export function FinanceiroPreFiscalExport({ registros, dateRange }: FinanceiroPreFiscalExportProps) {
  const [exporting, setExporting] = useState(false);

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const escapeCSV = (value: string | null | undefined) => {
    if (!value) return "";
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const handleExportCSV = async (tipo: "completo" | "contador" | "categorias") => {
    if (registros.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }

    setExporting(true);
    try {
      let csvContent = "\uFEFF"; // BOM for Excel
      let filename = "";

      if (tipo === "completo") {
        // Exportação completa com todos os campos
        csvContent += "Data,Tipo,Categoria,Descrição,Valor,Status,Classificação,Centro de Custo,Fornecedor,Forma Pagamento,Data Competência,Data Pagamento,Nº Documento,Obs. Contador\n";
        
        registros.forEach((r) => {
          const row = [
            format(parseISO(r.data), "dd/MM/yyyy"),
            r.tipo === "entrada" ? "Receita" : "Despesa",
            r.categoria_obj?.nome || r.origem,
            escapeCSV(r.descricao),
            `"${r.tipo === "entrada" ? "" : "-"}${formatCurrency(Number(r.valor))}"`,
            r.status === "pago" ? "Pago" : r.status === "a_receber" ? "A Receber" : r.status === "a_pagar" ? "A Pagar" : r.status,
            r.classificacao === "empresa" ? "Empresa" : "Pessoal",
            r.centro_custo?.nome || "",
            r.fornecedor?.nome || "",
            r.forma_pagamento?.nome || "",
            r.data_competencia ? format(parseISO(r.data_competencia), "dd/MM/yyyy") : "",
            r.data_pagamento ? format(parseISO(r.data_pagamento), "dd/MM/yyyy") : "",
            r.numero_documento || "",
            escapeCSV(r.observacoes_contador),
          ];
          csvContent += row.join(",") + "\n";
        });

        filename = `financeiro_completo`;
      } else if (tipo === "contador") {
        // Exportação simplificada para contador
        csvContent += "Data Competência,Tipo,Categoria,Descrição,Valor,Classificação,Centro de Custo,Nº Documento,Observações\n";
        
        const registrosEmpresa = registros.filter(r => r.classificacao === "empresa");
        
        registrosEmpresa.forEach((r) => {
          const row = [
            format(parseISO(r.data_competencia || r.data), "dd/MM/yyyy"),
            r.tipo === "entrada" ? "Receita" : "Despesa",
            r.categoria_obj?.nome || r.origem,
            escapeCSV(r.descricao),
            `"${r.tipo === "entrada" ? "" : "-"}${formatCurrency(Number(r.valor))}"`,
            "Empresa",
            r.centro_custo?.nome || "",
            r.numero_documento || "",
            escapeCSV(r.observacoes_contador),
          ];
          csvContent += row.join(",") + "\n";
        });

        // Totais
        const totalEntradas = registrosEmpresa
          .filter(r => r.tipo === "entrada")
          .reduce((sum, r) => sum + Number(r.valor), 0);
        const totalSaidas = registrosEmpresa
          .filter(r => r.tipo === "saida")
          .reduce((sum, r) => sum + Number(r.valor), 0);

        csvContent += "\n";
        csvContent += `,,TOTAL RECEITAS,,${formatCurrency(totalEntradas)},,,\n`;
        csvContent += `,,TOTAL DESPESAS,,"${formatCurrency(totalSaidas)}",,,\n`;
        csvContent += `,,LUCRO BRUTO,,${formatCurrency(totalEntradas - totalSaidas)},,,\n`;

        filename = `relatorio_contador`;
      } else if (tipo === "categorias") {
        // Relatório por categorias
        csvContent += "Categoria,Tipo,Total,Quantidade\n";
        
        const porCategoria: Record<string, { tipo: string; total: number; qtd: number }> = {};
        
        registros.forEach((r) => {
          const cat = r.categoria_obj?.nome || r.origem;
          if (!porCategoria[cat]) {
            porCategoria[cat] = { tipo: r.tipo === "entrada" ? "Receita" : "Despesa", total: 0, qtd: 0 };
          }
          porCategoria[cat].total += Number(r.valor);
          porCategoria[cat].qtd += 1;
        });

        Object.entries(porCategoria)
          .sort((a, b) => b[1].total - a[1].total)
          .forEach(([cat, data]) => {
            csvContent += `${escapeCSV(cat)},${data.tipo},"${formatCurrency(data.total)}",${data.qtd}\n`;
          });

        filename = `relatorio_categorias`;
      }

      // Add date range to filename
      if (dateRange) {
        filename += `_${format(parseISO(dateRange.start), "ddMMyyyy")}_${format(parseISO(dateRange.end), "ddMMyyyy")}`;
      } else {
        filename += `_${format(new Date(), "MMMM_yyyy", { locale: ptBR })}`;
      }

      // Download
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exporting} className="border-primary/20 hover:bg-primary/5">
          {exporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => handleExportCSV("contador")}>
          <FileText className="w-4 h-4 mr-2 text-primary" />
          <div className="flex flex-col">
            <span className="font-medium">Para Contador</span>
            <span className="text-xs text-muted-foreground">Apenas empresa, com totais</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExportCSV("completo")}>
          <FileSpreadsheet className="w-4 h-4 mr-2 text-success" />
          <div className="flex flex-col">
            <span className="font-medium">Completo</span>
            <span className="text-xs text-muted-foreground">Todos os campos</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExportCSV("categorias")}>
          <FileText className="w-4 h-4 mr-2 text-accent" />
          <div className="flex flex-col">
            <span className="font-medium">Por Categorias</span>
            <span className="text-xs text-muted-foreground">Resumo agrupado</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
