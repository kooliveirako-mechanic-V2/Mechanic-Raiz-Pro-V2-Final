import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { Copy, Check, Building2, User, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
import { OrdemServico } from "@/hooks/useOrdensServico";
import { useItensOS } from "@/hooks/useItensOS";
import { useOficina } from "@/contexts/OficinaContext";
import { useOficinaConfiguracoes } from "@/hooks/useOficinaConfiguracoes";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ResumoFiscalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordem: OrdemServico;
}

export function ResumoFiscalModal({ open, onOpenChange, ordem }: ResumoFiscalModalProps) {
  const isMobile = useIsMobile();
  const { oficinaAtual } = useOficina();
  const { configuracoes } = useOficinaConfiguracoes();
  const { itens, totalItens } = useItensOS(ordem?.id);
  const [observacoesFiscais, setObservacoesFiscais] = useState("");
  const [copied, setCopied] = useState(false);

  const getRegimeTributarioLabel = (regime?: string) => {
    switch (regime) {
      case "mei": return "MEI - Microempreendedor Individual";
      case "simples": return "Simples Nacional";
      case "lucro_presumido": return "Lucro Presumido";
      case "lucro_real": return "Lucro Real";
      default: return "Não informado";
    }
  };

  // CAUSA RAIZ: valor_servico JÁ inclui itens (via trigger). Não somar novamente.
  const valorTotal = (ordem.valor_servico || 0) > 0 ? (ordem.valor_servico || 0) : totalItens;
  const maoDeObraGlobal = (ordem as any).valor_mao_obra || 0;

  const osNumeroLabel = (ordem as any).numero
    ? `#${String((ordem as any).numero).padStart(3, "0")}`
    : `#${ordem.id.slice(0, 8).toUpperCase()}`;

  const formatDateSafe = (date: string) => {
    try {
      return format(new Date(date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return date;
    }
  };

  const gerarResumoTexto = () => {
    const linhas = [
      "═══════════════════════════════════════",
      "        RESUMO FISCAL - ORDEM DE SERVIÇO",
      "═══════════════════════════════════════",
      "",
      "📍 DADOS DA OFICINA",
      "─────────────────────────────────────",
      `Nome: ${(configuracoes as any)?.razao_social || oficinaAtual?.nome || "Não informado"}`,
      `Nome Fantasia: ${oficinaAtual?.nome || "Não informado"}`,
      `CNPJ: ${(configuracoes as any)?.cnpj || "Não informado"}`,
      `Inscrição Municipal: ${(configuracoes as any)?.inscricao_municipal || "Não informado"}`,
      `Município: ${(configuracoes as any)?.municipio || oficinaAtual?.endereco || "Não informado"}`,
      `Regime Tributário: ${getRegimeTributarioLabel((configuracoes as any)?.regime_tributario)}`,
      "",
      "👤 DADOS DO CLIENTE",
      "─────────────────────────────────────",
      `Nome: ${(ordem as any).cliente?.nome || "Não informado"}`,
      `CPF/CNPJ: ${(ordem as any).cliente?.cpf_cnpj || "Não informado"}`,
      `Telefone: ${(ordem as any).cliente?.telefone || "Não informado"}`,
      "",
      "🚗 DADOS DO VEÍCULO",
      "─────────────────────────────────────",
      `Veículo: ${(ordem as any).veiculo?.marca || ""} ${(ordem as any).veiculo?.modelo || ""}`,
      `Placa: ${(ordem as any).veiculo?.placa || "Não informado"}`,
      `Ano: ${(ordem as any).veiculo?.ano || "Não informado"}`,
      "",
      "📋 DADOS DA ORDEM DE SERVIÇO",
      "─────────────────────────────────────",
      `Número da OS: ${osNumeroLabel}`,
      `Data: ${formatDateSafe(ordem.data_servico)}`,
      `Tipo de Serviço: ${ordem.tipo_servico}`,
      "",
      "📝 DESCRIÇÃO DOS SERVIÇOS",
      "─────────────────────────────────────",
      ordem.descricao || "Sem descrição",
      "",
      "💰 VALORES",
      "─────────────────────────────────────",
      ...(itens.length > 0 ? itens.map(i => `  - ${i.quantidade}x ${i.nome_item}: ${formatCurrency(i.valor_total || 0)}`) : []),
      ...(maoDeObraGlobal > 0 ? [`  Mão de obra: ${formatCurrency(maoDeObraGlobal)}`] : []),
      `Valor Total: ${formatCurrency(valorTotal)}`,
      "",
    ];

    if (observacoesFiscais) {
      linhas.push(
        "📎 OBSERVAÇÕES FISCAIS",
        "─────────────────────────────────────",
        observacoesFiscais,
        ""
      );
    }

    linhas.push(
      "═══════════════════════════════════════",
      "Sistema de gestão operacional e pré-fiscal.",
      "A emissão de notas deve ser feita pelo emissor",
      "da prefeitura ou sistema fiscal de sua preferência.",
      "═══════════════════════════════════════"
    );

    return linhas.join("\n");
  };

  const handleCopy = async () => {
    const texto = gerarResumoTexto();
    await navigator.clipboard.writeText(texto);
    setCopied(true);
    toast.success("Resumo copiado!", {
      description: "Cole no emissor de NF da prefeitura"
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyField = async (value: string, label: string) => {
    if (!value || value === "Não informado") {
      toast.error("Campo vazio");
      return;
    }
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado!`);
  };

  const InnerContent = (
    <div className="space-y-6">
      {/* Dados da Oficina */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">DADOS DA OFICINA</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-4 rounded-lg">
          <DataField label="Razão Social" value={(configuracoes as any)?.razao_social || oficinaAtual?.nome} onCopy={handleCopyField} />
          <DataField label="Nome Fantasia" value={oficinaAtual?.nome} onCopy={handleCopyField} />
          <DataField label="CNPJ" value={(configuracoes as any)?.cnpj} onCopy={handleCopyField} />
          <DataField label="Inscrição Municipal" value={(configuracoes as any)?.inscricao_municipal} onCopy={handleCopyField} />
          <DataField label="Município" value={(configuracoes as any)?.municipio || oficinaAtual?.endereco} onCopy={handleCopyField} />
          <DataField label="Regime Tributário" value={getRegimeTributarioLabel((configuracoes as any)?.regime_tributario)} />
        </div>
      </div>

      <Separator />

      {/* Dados do Cliente */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">DADOS DO TOMADOR (CLIENTE)</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-4 rounded-lg">
          <DataField label="Nome/Razão Social" value={(ordem as any).cliente?.nome} onCopy={handleCopyField} />
          <DataField label="CPF/CNPJ" value={(ordem as any).cliente?.cpf_cnpj} onCopy={handleCopyField} />
          <DataField label="Telefone" value={(ordem as any).cliente?.telefone} onCopy={handleCopyField} />
          <DataField label="Endereço" value={(ordem as any).cliente?.endereco} onCopy={handleCopyField} />
          <DataField label="E-mail" value={(ordem as any).cliente?.email} onCopy={handleCopyField} />
          <DataField label="Placa do Veículo" value={(ordem as any).veiculo?.placa} onCopy={handleCopyField} />
        </div>
      </div>

      <Separator />

      {/* Dados da OS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">DADOS DA ORDEM DE SERVIÇO</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 p-4 rounded-lg">
          <DataField label="Número da OS" value={osNumeroLabel} onCopy={handleCopyField} />
          <DataField label="Data" value={formatDateSafe(ordem.data_servico)} onCopy={handleCopyField} />
          <div className="col-span-2">
            <DataField label="Tipo de Serviço" value={ordem.tipo_servico} onCopy={handleCopyField} />
          </div>
        </div>
      </div>

      {/* Discriminação dos Serviços */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-semibold text-sm">Discriminação dos Serviços</Label>
          <Button variant="ghost" size="sm" onClick={() => handleCopyField(ordem.descricao || ordem.tipo_servico, "Descrição")}>
            <Copy className="w-3.5 h-3.5 mr-1" />
            Copiar
          </Button>
        </div>
        <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap">
          {ordem.descricao || ordem.tipo_servico}
        </div>
      </div>

      {/* Valores com breakdown de itens */}
      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          💰 VALORES
        </h3>
        <div className="space-y-2 text-sm">
          {itens.length > 0 && itens.map((item) => (
            <div key={item.id} className="flex justify-between items-center">
              <span className="text-muted-foreground">{item.quantidade}x {item.nome_item}</span>
              <span className="font-medium flex-shrink-0">{formatCurrency(item.valor_total || 0)}</span>
            </div>
          ))}
          {maoDeObraGlobal > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Mão de obra</span>
              <span className="font-medium flex-shrink-0">{formatCurrency(maoDeObraGlobal)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between items-center">
            <span className="font-semibold">Valor Total do Serviço:</span>
            <span className="font-bold text-lg">{formatCurrency(valorTotal)}</span>
          </div>
        </div>
      </div>

      {/* Observações Fiscais */}
      <div className="space-y-2">
        <Label htmlFor="obs-fiscais">Observações Fiscais (opcional)</Label>
        <Textarea
          id="obs-fiscais"
          placeholder="Adicione observações que devem constar na NF..."
          value={observacoesFiscais}
          onChange={(e) => setObservacoesFiscais(e.target.value)}
          rows={3}
        />
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
        ⚠️ <strong>Importante:</strong> Este é um sistema de gestão operacional e pré-fiscal.
        Ele organiza os dados para facilitar a emissão de notas fiscais.
        A emissão de NF-e ou NFS-e deve ser feita pelo emissor da prefeitura ou sistema fiscal de sua preferência.
      </div>

      {/* Botão principal */}
      <Button onClick={handleCopy} className="w-full h-12 bg-accent hover:bg-accent/90" size="lg">
        {copied ? (
          <>
            <Check className="w-5 h-5 mr-2" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="w-5 h-5 mr-2" />
            COPIAR RESUMO FISCAL
          </>
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="px-4 pb-6 max-h-[95dvh]">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30 mx-auto mt-2 mb-1" />
          <DrawerHeader className="text-left px-0">
            <DrawerTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-accent" />
              Resumo Fiscal da OS
            </DrawerTitle>
            <p className="text-sm text-muted-foreground">
              Copie os dados para lançar no emissor de NF
            </p>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 min-h-0 overscroll-contain touch-pan-y" style={{ WebkitOverflowScrolling: "touch" }}>
            {InnerContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" />
            Resumo Fiscal da OS
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Copie os dados para lançar no emissor de NF da prefeitura
          </p>
        </DialogHeader>
        {InnerContent}
      </DialogContent>
    </Dialog>
  );
}

function DataField({
  label,
  value,
  onCopy
}: {
  label: string;
  value?: string | null;
  onCopy?: (value: string, label: string) => void;
}) {
  const displayValue = value || "Não informado";
  const hasValue = value && value !== "Não informado";

  return (
    <div className="space-y-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <span className={hasValue ? "font-medium" : "text-muted-foreground italic"}>
          {displayValue}
        </span>
        {hasValue && onCopy && (
          <button
            onClick={() => onCopy(displayValue, label)}
            className="p-1.5 min-w-[28px] min-h-[28px] hover:bg-background rounded transition-colors"
            title={`Copiar ${label}`}
          >
            <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
