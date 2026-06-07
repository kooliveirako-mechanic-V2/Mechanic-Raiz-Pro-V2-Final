import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Transaction {
  id: string;
  type: "entrada" | "saida";
  category: string;
  description: string;
  value: number;
  date: string;
  status?: string;
  classificacao?: string;
}

interface FinanceiroExportProps {
  transactions: Transaction[];
  dateRange?: { start: string; end: string } | null;
}

export function FinanceiroExport({ transactions, dateRange }: FinanceiroExportProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (transactions.length === 0) {
      toast.error("Nenhum lançamento para exportar");
      return;
    }

    setExporting(true);

    try {
      // Create CSV content
      const headers = ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Status", "Classificação"];
      const rows = transactions.map((t) => [
        t.date,
        t.type === "entrada" ? "Entrada" : "Saída",
        t.category,
        t.description.replace(/,/g, ";"),
        t.type === "entrada" 
          ? t.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
          : `-${t.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        t.status || "pago",
        t.classificacao || "empresa",
      ]);

      // Calculate totals
      const totalEntradas = transactions
        .filter((t) => t.type === "entrada")
        .reduce((sum, t) => sum + t.value, 0);
      const totalSaidas = transactions
        .filter((t) => t.type === "saida")
        .reduce((sum, t) => sum + t.value, 0);
      const lucro = totalEntradas - totalSaidas;

      // Add empty row and totals
      rows.push([]);
      rows.push(["", "", "", "Total Entradas", totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })]);
      rows.push(["", "", "", "Total Saídas", `-${totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`]);
      rows.push(["", "", "", "Lucro Líquido", lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      // Add BOM for Excel compatibility
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      const dateStr = dateRange 
        ? `${format(new Date(dateRange.start), "dd-MM-yyyy")}_${format(new Date(dateRange.end), "dd-MM-yyyy")}`
        : format(new Date(), "MMMM-yyyy", { locale: ptBR });
      
      link.href = url;
      link.download = `financeiro_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Relatório exportado!", {
        description: `${transactions.length} lançamentos exportados`,
      });
    } catch (error) {
      toast.error("Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      className="border-accent/20 hover:bg-accent/5"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2 text-accent" />
      )}
      Exportar
    </Button>
  );
}
