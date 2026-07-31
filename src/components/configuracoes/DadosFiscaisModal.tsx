import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useOficinaConfiguracoes } from "@/hooks/useOficinaConfiguracoes";
import { useModalClose } from "@/hooks/useModalClose";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Building2, Receipt, Loader2, Info, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface DadosFiscaisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DadosFiscaisModal({ open, onOpenChange }: DadosFiscaisModalProps) {
  const { configuracoes, updateConfiguracoes, isLoading } = useOficinaConfiguracoes();
  const [saving, setSaving] = useState(false);

  // Sem useAutoSave de propósito: são dados cadastrais identificáveis da empresa
  // (CNPJ, razão social, inscrição municipal). Persistir em localStorage no PC do
  // balcão criaria superfície nova sem ganho — o dado recarrega do servidor.
  // Proteção aqui é confirmação ao fechar, apenas.

  // Form state
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [regimeTributario, setRegimeTributario] = useState("mei");
  const [cfopServicos, setCfopServicos] = useState("5933");
  const [cfopVendas, setCfopVendas] = useState("5102");

  // Sync state with configuracoes
  // Sinal para o useModalClose: a hidratação abaixo terminou. `!!configuracoes`
  // não serve — ele é verdadeiro no render em que os dados CHEGAM, antes deste
  // useEffect preencher os campos. O snapshot pegaria os campos vazios e a
  // hidratação viraria "edição do usuário" (falso-sujo em toda abertura).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!open) {
      setHydrated(false);
      return;
    }
    if (configuracoes) {
      const config = configuracoes as any;
      setRazaoSocial(config.razao_social || "");
      setCnpj(config.cnpj || "");
      setInscricaoMunicipal(config.inscricao_municipal || "");
      setMunicipio(config.municipio || "");
      setRegimeTributario(config.regime_tributario || "mei");
      setCfopServicos(config.cfop_servicos || "5933");
      setCfopVendas(config.cfop_vendas || "5102");
      setHydrated(true);
    }
  }, [configuracoes, open]);

  const formData = {
    razaoSocial,
    cnpj,
    inscricaoMunicipal,
    municipio,
    regimeTributario,
    cfopServicos,
    cfopVendas,
    saving, // volátil (ignoreKeys) — flag de UI durante o submit
  };

  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open,
    data: formData,
    onOpenChange,
    ignoreKeys: ["saving"],
    // Condição 1: só depois que o useEffect de hidratação RODOU (não basta os
    // dados terem chegado — ver comentário do `hydrated` acima).
    snapshotReady: hydrated,
  });

  // Formatar CNPJ
  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 14) {
      return numbers
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return value;
  };

  const handleCnpjChange = (value: string) => {
    setCnpj(formatCNPJ(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateConfiguracoes.mutateAsync({
        razao_social: razaoSocial.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        inscricao_municipal: inscricaoMunicipal.trim() || undefined,
        municipio: municipio.trim() || undefined,
        regime_tributario: regimeTributario,
        cfop_servicos: cfopServicos.trim() || undefined,
        cfop_vendas: cfopVendas.trim() || undefined,
      } as any);
      
      toast.success("Dados fiscais salvos!");
      onOpenChange(false);
    } catch (error) {
      // Error handled by hook
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    // Mesmo handler do estado principal — sem passthrough. Neste estado não há o
    // que perder (dados nem carregaram), mas a assimetria é o que a Fase 3
    // replicaria sem pensar; o guard trata snapshotReady=false como nunca-sujo.
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" />
            Dados Fiscais da Oficina
          </DialogTitle>
          <DialogDescription>
            Esses dados são usados apenas para organização pré-fiscal e apoio ao contador
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identificação */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="w-4 h-4 text-primary" />
              Identificação da Empresa
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="razaoSocial">Razão Social</Label>
                <Input
                  id="razaoSocial"
                  placeholder="Nome completo da empresa"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => handleCnpjChange(e.target.value)}
                    maxLength={18}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inscricaoMunicipal">Inscrição Municipal</Label>
                  <Input
                    id="inscricaoMunicipal"
                    placeholder="Número"
                    value={inscricaoMunicipal}
                    onChange={(e) => setInscricaoMunicipal(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="municipio">Município</Label>
                <Input
                  id="municipio"
                  placeholder="Ex: São Paulo - SP"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Regime Tributário */}
          <div className="space-y-4">
            <Label>Regime Tributário</Label>
            <Select value={regimeTributario} onValueChange={setRegimeTributario}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o regime" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mei">MEI - Microempreendedor Individual</SelectItem>
                <SelectItem value="simples">Simples Nacional</SelectItem>
                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                <SelectItem value="lucro_real">Lucro Real</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* CFOP Padrão — colapsado por padrão (avançado) */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>CFOP e dados avançados (para contador)</span>
              </div>
              <ChevronDown className="w-4 h-4 transition-transform [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Códigos fiscais mais usados. Consulte seu contador se tiver dúvidas.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cfopServicos">CFOP Serviços</Label>
                  <Input
                    id="cfopServicos"
                    placeholder="5933"
                    value={cfopServicos}
                    onChange={(e) => setCfopServicos(e.target.value)}
                    maxLength={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: 5933 (serviço local)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cfopVendas">CFOP Vendas</Label>
                  <Input
                    id="cfopVendas"
                    placeholder="5102"
                    value={cfopVendas}
                    onChange={(e) => setCfopVendas(e.target.value)}
                    maxLength={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: 5102 (venda local)
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Disclaimer */}
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs text-warning">
            ⚠️ <strong>Importante:</strong> Estes dados são usados apenas para organização e relatórios internos. 
            Não substituem a emissão de notas fiscais, que deve ser feita pelo emissor da prefeitura ou sistema contábil.
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-accent hover:bg-accent/90"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Dados Fiscais"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Sair sem salvar?"
      description="Você alterou os dados fiscais e não salvou. As alterações serão descartadas."
      confirmText="Descartar"
      cancelText="Continuar editando"
      onConfirm={confirmClose}
    />
    </>
  );
}
