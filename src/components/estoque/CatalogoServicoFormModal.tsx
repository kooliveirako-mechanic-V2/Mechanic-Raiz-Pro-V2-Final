import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCatalogoServicos, CatalogoServico, TipoVeiculoCatalogo } from "@/hooks/useCatalogoServicos";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { parseCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servico?: CatalogoServico | null;
}

export function CatalogoServicoFormModal({ open, onOpenChange, servico }: Props) {
  const isMobile = useIsMobile();
  const { createServico, updateServico } = useCatalogoServicos();
  const [nome, setNome] = useState("");
  const [tipoVeiculo, setTipoVeiculo] = useState<TipoVeiculoCatalogo>("todos");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState("");
  const [tempo, setTempo] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (open) {
      setNome(servico?.nome || "");
      setTipoVeiculo((servico?.tipo_veiculo as TipoVeiculoCatalogo) || "todos");
      setCategoria(servico?.categoria || "");
      setValor(servico?.valor_mao_obra ? String(servico.valor_mao_obra) : "");
      setTempo(servico?.tempo_estimado_minutos ? String(servico.tempo_estimado_minutos) : "");
      setDescricao(servico?.descricao || "");
    }
  }, [open, servico]);

  const loading = createServico.isPending || updateServico.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do serviço");
      return;
    }
    const v = parseCurrency(valor);
    if (v <= 0) {
      toast.error("Informe o valor da mão de obra");
      return;
    }

    const payload = {
      nome: nome.trim(),
      tipo_veiculo: tipoVeiculo,
      categoria: categoria.trim() || "geral",
      valor_mao_obra: v,
      tempo_estimado_minutos: tempo ? parseInt(tempo) : null,
      descricao: descricao.trim() || null,
    };

    try {
      if (servico) {
        await updateServico.mutateAsync({ id: servico.id, ...payload });
      } else {
        await createServico.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast já tratado
    }
  };

  const FormBody = (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="cs-nome">Nome do serviço *</Label>
        <Input
          id="cs-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Troca de embreagem moto até 160cc"
          className="h-11"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cs-tipo">Tipo de veículo</Label>
          <Select value={tipoVeiculo} onValueChange={(v) => setTipoVeiculo(v as TipoVeiculoCatalogo)}>
            <SelectTrigger id="cs-tipo" className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="carro">Carro</SelectItem>
              <SelectItem value="moto">Moto</SelectItem>
              <SelectItem value="eletrica">Auto Elétrica</SelectItem>
              <SelectItem value="caminhao">Caminhão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cs-cat">Categoria</Label>
          <Input
            id="cs-cat"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Ex: Transmissão"
            className="h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cs-valor">Valor mão de obra (R$) *</Label>
          <CurrencyInput value={valor} onValueChange={setValor} className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cs-tempo">Tempo estimado (min)</Label>
          <Input
            id="cs-tempo"
            type="number"
            inputMode="numeric"
            min="0"
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            placeholder="Ex: 120"
            className="h-11"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="cs-desc">Descrição (opcional)</Label>
        <Textarea
          id="cs-desc"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Detalhes do serviço, peças incluídas, etc."
          rows={3}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-11">
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="flex-1 h-11">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : servico ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );

  const Header = (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
        <Wrench className="w-5 h-5 text-primary" />
      </div>
      <span>{servico ? "Editar serviço" : "Novo serviço"}</span>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{Header}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto">{FormBody}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{Header}</DialogTitle>
        </DialogHeader>
        {FormBody}
      </DialogContent>
    </Dialog>
  );
}
