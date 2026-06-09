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
import { getUnifiedMetrics } from "@/services/financeiroService";
import { financeiroV2Service } from "@/services/financeiroV2Service";
import { FEATURE_FLAGS_V2 } from "@/config/featureFlagsV2";

// FEATURE FLAG: FINANCEIRO_V2_PDF_ENABLED
export const FINANCEIRO_V2_PDF_ENABLED = FEATURE_FLAGS_V2.PDF_V2_ENABLED;

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

      // 1. Coleta de dados via motor apropriado
      let pdfData;
      if (FINANCEIRO_V2_PDF_ENABLED) {
        pdfData = await financeiroV2Service.getMetrics(oficinaAtual.id, inicio, fim);
      } else {
        const legacyMetrics = await getUnifiedMetrics({
          oficinaId: oficinaAtual.id,
          inicio,
          fim,
        });
        // Adaptador para manter o motor de PDF legado funcionando
        pdfData = {
          competencia: {
            faturamento_bruto: legacyMetrics.faturamento.bruto,
            descontos: legacyMetrics.faturamento.descontos,
            faturamento_liquido: legacyMetrics.faturamento.liquido,
            saldo_a_receber_competencia: legacyMetrics.caixa.saldo_a_receber_competencia,
          },
          custos: { cmv_total: legacyMetrics.operacional.custo_pecas },
          resultado: { lucro_operacional: legacyMetrics.operacional.lucro_operacional },
          caixa: {
            entradas_pagas_no_periodo: legacyMetrics.caixa.entradas_oficina_periodo,
            saidas_pagas_no_periodo: legacyMetrics.caixa.saidas_oficina_periodo,
            saldo_caixa_periodo: legacyMetrics.caixa.lucro_caixa_oficina_periodo,
          },
          auditoria: { avisos: [], registros_os: [], registros_vendas: [] }
        };
      }

      const rankings = await supabase.rpc("get_financeiro_rankings_unificados", {
        p_oficina_id: oficinaAtual.id,
        p_data_inicio: inicio,
        p_data_fim: fim,
      });

      const top5 = ((rankings.data as any)?.servicos || [])
        .slice(0, 5)
        .map((s: any) => [s.tipo_servico, s.total_os]);

      const totalOS = (rankings.data as any)?.geral?.total_os_analisadas || 0;

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
      doc.text("Resumo de Operações", 25, y);
      y += 10;

      addLine("Total de OS no período:", String(totalOS));
      y += 4;
      
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo Financeiro (Fonte Única)", 25, y);
      y += 10;

      addLine("Faturamento Bruto:", formatCurrency(pdfData.competencia.faturamento_bruto || 0));
      addLine("Descontos Concedidos:", formatCurrency(pdfData.competencia.descontos || 0));
      addLine("FATURAMENTO LÍQUIDO:", formatCurrency(pdfData.competencia.faturamento_liquido), true);
      y += 4;
      addLine("Custo de Operação (CMV):", formatCurrency(pdfData.custos.cmv_total));
      addLine("LUCRO OPERACIONAL:", formatCurrency(pdfData.resultado.lucro_operacional), true);
      y += 4;
      doc.setDrawColor(230);
      doc.line(25, y, pageWidth - 25, y);
      y += 6;
      addLine("Entradas de Caixa no Período:", formatCurrency(pdfData.caixa.entradas_pagas_no_periodo));
      addLine("Saídas de Caixa no Período:", formatCurrency(pdfData.caixa.saidas_pagas_no_periodo));
      addLine("SALDO DE CAIXA:", formatCurrency(pdfData.caixa.saldo_caixa_periodo), true);
      y += 4;
      addLine("Saldo a Receber (Competência):", formatCurrency(pdfData.competencia.saldo_a_receber_competencia));

      // Auditoria no PDF V2 (Modo Interno)
      if (FINANCEIRO_V2_PDF_ENABLED) {
        y += 12;
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Detalhamento de Auditoria V2", 25, y);
        y += 6;
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        
        if (FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED && (pdfData as any).modo === "preview_limpeza_logica") {
          doc.text("MODO V2 LIMPO ATIVO: Registros de teste ignorados por manifesto. Nenhum dado real alterado.", 25, y);
        } else {
          doc.text("A marcação de teste é apenas informativa e não altera os cálculos.", 25, y);
        }
        y += 6;

        const auditRows = [
          ...(pdfData.auditoria.registros_os || []).map(os => [`OS #${os.numero}`, formatCurrency(os.valor_liquido), os.is_teste ? "TESTE" : "REAL"]),
          ...(pdfData.auditoria.registros_vendas || []).map(v => [`Venda #${v.numero}`, formatCurrency(v.valor_liquido), v.is_teste ? "TESTE" : "REAL"]),
          ...(FEATURE_FLAGS_V2.FINANCEIRO_V2_IGNORE_TEST_MANIFEST_ENABLED && (pdfData as any).auditoria?.registros_ignorados_por_manifesto 
            ? (pdfData as any).auditoria.registros_ignorados_por_manifesto.map((r: any) => [`${r.tipo} #${r.numero}`, formatCurrency(r.valor_liquido), "IGNORADO (MANIFESTO)"])
            : [])
        ];

        if (auditRows.length > 0) {
          autoTable(doc, {
            startY: y,
            head: [["Registro", "Valor Líquido", "Classificação"]],
            body: auditRows,
            margin: { left: 25, right: 25 },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [80, 80, 80] }
          });
          y = (doc as any).lastAutoTable.finalY + 10;
        } else {
          y += 4;
        }
      }

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