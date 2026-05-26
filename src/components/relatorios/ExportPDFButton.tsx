import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useOficina } from "@/contexts/OficinaContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/formatters";

export function ExportPDFButton() {
  const { oficinaAtual } = useOficina();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!oficinaAtual) return;
    setLoading(true);

    try {
      const now = new Date();
      const inicio = format(startOfMonth(now), "yyyy-MM-dd");
      const fim = format(endOfMonth(now), "yyyy-MM-dd");
      const mesLabel = format(now, "MMMM 'de' yyyy", { locale: ptBR });

      // Fetch OS data and financial summary in parallel (RPC consolidada)
      const [osRes, finResumo, servRes, prejRes] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("id, valor_servico, status, tipo_servico")
          .eq("oficina_id", oficinaAtual.id)
          .gte("data_servico", inicio)
          .lte("data_servico", fim),
        supabase.rpc("get_financeiro_resumo", {
          p_oficina_id: oficinaAtual.id,
          p_meses_historico: 1,
        }),
        supabase
          .from("ordens_servico")
          .select("tipo_servico")
          .eq("oficina_id", oficinaAtual.id)
          .eq("status", "finalizado")
          .gte("data_servico", inicio)
          .lte("data_servico", fim),
        supabase
          .from("financeiro")
          .select("valor, categoria")
          .eq("oficina_id", oficinaAtual.id)
          .eq("tipo", "saida")
          .gte("data", inicio)
          .lte("data", fim),
      ]);

      const os = osRes.data || [];
      const resumo = finResumo.data as any;
      const servicos = servRes.data || [];
      const saidasRows = (prejRes.data || []) as Array<{ valor: number; categoria: string }>;

      const totalOS = os.length;
      const osFinalizadas = os.filter(o => o.status === "finalizado").length;
      const entradas = Number(resumo?.mes_atual?.entradas) || 0;
      const saidas = Number(resumo?.mes_atual?.saidas) || 0;
      const prejuizos = saidasRows
        .filter(r => r.categoria === "prejuizo")
        .reduce((s, r) => s + Number(r.valor || 0), 0);
      const comissoes = saidasRows
        .filter(r => r.categoria === "comissao")
        .reduce((s, r) => s + Number(r.valor || 0), 0);
      const despesasOperacionais = saidas - prejuizos - comissoes;
      const lucro = entradas - despesasOperacionais - comissoes - prejuizos;

      // Top 5 services
      const servicoMap: Record<string, number> = {};
      servicos.forEach(s => {
        servicoMap[s.tipo_servico] = (servicoMap[s.tipo_servico] || 0) + 1;
      });
      const top5 = Object.entries(servicoMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(oficinaAtual.nome, pageWidth / 2, 25, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Relatório Mensal — ${mesLabel}`, pageWidth / 2, 33, { align: "center" });

      doc.setDrawColor(200);
      doc.line(20, 38, pageWidth - 20, 38);

      // Summary
      let y = 48;
      const addLine = (label: string, value: string, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(11);
        doc.text(label, 25, y);
        doc.text(value, pageWidth - 25, y, { align: "right" });
        y += 8;
      };

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo do Mês", 25, y);
      y += 10;

      addLine("Total de OS no mês:", String(totalOS));
      addLine("OS finalizadas:", String(osFinalizadas));
      y += 4;
      addLine("Faturamento (entradas):", formatCurrency(entradas), true);
      addLine("Despesas operacionais:", formatCurrency(despesasOperacionais));
      if (comissoes > 0) addLine("Comissões pagas:", formatCurrency(comissoes));
      if (prejuizos > 0) addLine("⚠ Prejuízos / Retrabalho:", formatCurrency(prejuizos));
      y += 2;
      doc.setDrawColor(200);
      doc.line(25, y, pageWidth - 25, y);
      y += 6;
      addLine("LUCRO LÍQUIDO:", formatCurrency(lucro), true);

      // Top services table
      if (top5.length > 0) {
        y += 12;
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Top 5 Serviços Mais Realizados", 25, y);
        y += 4;

        autoTable(doc, {
          startY: y,
          head: [["#", "Serviço", "Quantidade"]],
          body: top5.map(([nome, qtd], i) => [String(i + 1), nome, String(qtd)]),
          margin: { left: 25, right: 25 },
          styles: { fontSize: 10, cellPadding: 3 },
          headStyles: { fillColor: [30, 30, 30], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      // Footer
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150);
      doc.text(
        `Gerado pelo Mechanic Raiz Pro — mecanicraizpro.com.br — ${format(now, "dd/MM/yyyy HH:mm")}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );

      doc.save(`relatorio-${format(now, "yyyy-MM")}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o relatório PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={loading || !oficinaAtual}
      className="gap-2"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
      📄 Exportar PDF do Mês
    </Button>
  );
}
