import { useState, useEffect } from "react";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { resolveFotoUrl } from "@/lib/storage/fotos";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Camera, X, Fuel, AlertTriangle, CircleDot, Volume2, Lightbulb, 
  Loader2, ImagePlus, Car, Bike, Shield, Link2, ChevronDown, ClipboardList,
  Zap, Battery, Cpu, Cable, CircuitBoard, Gauge, PlugZap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOficina } from "@/contexts/OficinaContext";
import { validateFile, safeFileName } from "@/lib/uploadValidation";

interface ChecklistDVIProps {
  combustivel: string;
  setCombustivel: (value: string) => void;
  riscos: boolean;
  setRiscos: (value: boolean) => void;
  estepe: boolean;
  setEstepe: (value: boolean) => void;
  som: boolean;
  setSom: (value: boolean) => void;
  luzes: boolean;
  setLuzes: (value: boolean) => void;
  fotos: string[];
  setFotos: (value: string[]) => void;
  ordemId?: string;
  tipoVeiculo?: "carro" | "moto";
  // Campos extras para Auto Elétrica
  checklistEletrico?: {
    bateria: boolean;
    alternador: boolean;
    motorPartida: boolean;
    fusiveisReles: boolean;
    cargaBateria: string;
    voltagemBateria: string;
  };
  setChecklistEletrico?: (value: ChecklistDVIProps['checklistEletrico']) => void;
}

const combustivelOptions = [
  { value: "vazio", label: "Reserva", icon: "🔴" },
  { value: "1/4", label: "1/4", icon: "🟠" },
  { value: "1/2", label: "1/2", icon: "🟡" },
  { value: "3/4", label: "3/4", icon: "🟢" },
  { value: "cheio", label: "Cheio", icon: "✅" },
];

const cargaBateriaOptions = [
  { value: "0-25", label: "0-25%", icon: "🔴" },
  { value: "25-50", label: "25-50%", icon: "🟠" },
  { value: "50-75", label: "50-75%", icon: "🟡" },
  { value: "75-100", label: "75-100%", icon: "🟢" },
];

interface ChecklistItemProps {
  icon: typeof AlertTriangle;
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  id: string;
}

function ChecklistItem({ icon: Icon, label, checked, onCheckedChange, id }: ChecklistItemProps) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-3 rounded-xl border transition-all",
        checked 
          ? "bg-success/5 border-success/20" 
          : "bg-muted/30 border-border"
      )}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cn(
          "w-4 h-4 transition-colors",
          checked ? "text-success" : "text-muted-foreground"
        )} />
        <Label 
          htmlFor={id} 
          className={cn(
            "text-sm cursor-pointer",
            checked ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </Label>
      </div>
      <Switch 
        id={id} 
        checked={checked} 
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-success"
      />
    </div>
  );
}

export function ChecklistDVI({
  combustivel,
  setCombustivel,
  riscos,
  setRiscos,
  estepe,
  setEstepe,
  som,
  setSom,
  luzes,
  setLuzes,
  fotos,
  setFotos,
  ordemId,
  tipoVeiculo,
  checklistEletrico,
  setChecklistEletrico,
}: ChecklistDVIProps) {
  const { oficinaAtual } = useOficina();
  const isAutoEletrica = oficinaAtual?.tipo === "auto_eletrica";
  
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<"carro" | "moto" | "eletrico" | null>(
    isAutoEletrica ? "eletrico" : tipoVeiculo || null
  );

  // Estado local para checklist elétrico quando não fornecido via props
  const [localChecklistEletrico, setLocalChecklistEletrico] = useState({
    bateria: false,
    alternador: false,
    motorPartida: false,
    fusiveisReles: false,
    cargaBateria: "",
    voltagemBateria: "",
  });

  const eletricoState = checklistEletrico || localChecklistEletrico;
  const setEletricoState = setChecklistEletrico || setLocalChecklistEletrico;

  // Sincroniza o tipo selecionado quando o tipo do veículo muda
  useEffect(() => {
    if (isAutoEletrica) {
      setTipoSelecionado("eletrico");
    } else if (tipoVeiculo) {
      setTipoSelecionado(tipoVeiculo);
    }
  }, [tipoVeiculo, isAutoEletrica]);

  // Abrir automaticamente se já tem dados preenchidos
  useEffect(() => {
    const hasData = combustivel || riscos || estepe || som || luzes || 
      eletricoState.bateria || eletricoState.alternador || eletricoState.motorPartida || eletricoState.fusiveisReles;
    if (hasData) {
      setIsOpen(true);
    }
    if (fotos.length > 0) {
      setShowPhotos(true);
    }
  }, [combustivel, riscos, estepe, som, luzes, fotos.length, eletricoState]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newFotos: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const validation = validateFile(file, "image_or_video");
        if (!validation.ok) {
          toast.error(validation.error!);
          continue;
        }

        const fileName = safeFileName(file.name);
        const filePath = `${ordemId || "temp"}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("os-fotos")
          .upload(filePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erro ao fazer upload: ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("os-fotos")
          .getPublicUrl(filePath);

        if (urlData) {
          newFotos.push(urlData.publicUrl);
        }
      }

      if (newFotos.length > 0) {
        setFotos([...fotos, ...newFotos]);
        toast.success(`${newFotos.length} arquivo(s) adicionado(s)!`);
      }
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const removeFoto = (index: number) => {
    const newFotos = fotos.filter((_, i) => i !== index);
    setFotos(newFotos);
  };

  // Render checklist items based on vehicle type
  const renderChecklistItems = () => {
    if (!tipoSelecionado) return null;

    // Checklist específico para Auto Elétrica
    if (tipoSelecionado === "eletrico") {
      return (
        <div className="space-y-4">
          {/* Voltagem da Bateria */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-500" />
              <Label className="text-sm font-medium">Voltagem da Bateria</Label>
            </div>
            <div className="grid grid-cols-4 gap-2">
                {["< 11V", "11-12V", "12-13V", "> 13V"].map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={eletricoState.voltagemBateria === v ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-9 text-xs",
                    eletricoState.voltagemBateria === v && 
                    (v === "< 11V" ? "bg-destructive" : v === "11-12V" ? "bg-warning" : "bg-success")
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEletricoState({ ...eletricoState, voltagemBateria: v });
                  }}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          {/* Carga da Bateria */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm">Carga da Bateria</Label>
            </div>
            <Select 
              value={eletricoState.cargaBateria} 
              onValueChange={(v) => setEletricoState({ ...eletricoState, cargaBateria: v })}
            >
              <SelectTrigger className="w-full h-11">
                <SelectValue placeholder="Selecione a carga" />
              </SelectTrigger>
              <SelectContent>
                {cargaBateriaOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Componentes Elétricos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <ChecklistItem
              icon={Battery}
              label="Bateria OK"
              checked={eletricoState.bateria}
              onCheckedChange={(v) => setEletricoState({ ...eletricoState, bateria: v })}
              id="bateria"
            />
            <ChecklistItem
              icon={Cpu}
              label="Alternador OK"
              checked={eletricoState.alternador}
              onCheckedChange={(v) => setEletricoState({ ...eletricoState, alternador: v })}
              id="alternador"
            />
            <ChecklistItem
              icon={PlugZap}
              label="Motor de Partida OK"
              checked={eletricoState.motorPartida}
              onCheckedChange={(v) => setEletricoState({ ...eletricoState, motorPartida: v })}
              id="motorPartida"
            />
            <ChecklistItem
              icon={CircuitBoard}
              label="Fusíveis/Relés OK"
              checked={eletricoState.fusiveisReles}
              onCheckedChange={(v) => setEletricoState({ ...eletricoState, fusiveisReles: v })}
              id="fusiveisReles"
            />
            <ChecklistItem
              icon={Lightbulb}
              label="Sistema de Iluminação OK"
              checked={luzes}
              onCheckedChange={setLuzes}
              id="iluminacao"
            />
            <ChecklistItem
              icon={AlertTriangle}
              label="Danos Visíveis"
              checked={riscos}
              onCheckedChange={setRiscos}
              id="danos"
            />
          </div>
        </div>
      );
    }

    if (tipoSelecionado === "carro") {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <ChecklistItem
            icon={AlertTriangle}
            label="Riscos/Avarias"
            checked={riscos}
            onCheckedChange={setRiscos}
            id="riscos"
          />
          <ChecklistItem
            icon={CircleDot}
            label="Estepe OK"
            checked={estepe}
            onCheckedChange={setEstepe}
            id="estepe"
          />
          <ChecklistItem
            icon={Volume2}
            label="Som/Rádio OK"
            checked={som}
            onCheckedChange={setSom}
            id="som"
          />
          <ChecklistItem
            icon={Lightbulb}
            label="Luzes/Faróis OK"
            checked={luzes}
            onCheckedChange={setLuzes}
            id="luzes"
          />
        </div>
      );
    }

    // Moto checklist
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <ChecklistItem
          icon={AlertTriangle}
          label="Riscos/Avarias"
          checked={riscos}
          onCheckedChange={setRiscos}
          id="riscos"
        />
        <ChecklistItem
          icon={Lightbulb}
          label="Luzes/Faróis OK"
          checked={luzes}
          onCheckedChange={setLuzes}
          id="luzes"
        />
        <ChecklistItem
          icon={Link2}
          label="Corrente/Transmissão OK"
          checked={som}
          onCheckedChange={setSom}
          id="corrente"
        />
        <ChecklistItem
          icon={Shield}
          label="Retrovisores OK"
          checked={estepe}
          onCheckedChange={setEstepe}
          id="retrovisores"
        />
      </div>
    );
  };

  // Contador de itens preenchidos
  const getChecklistCount = () => {
    if (tipoSelecionado === "eletrico") {
      return [
        eletricoState.bateria,
        eletricoState.alternador,
        eletricoState.motorPartida,
        eletricoState.fusiveisReles,
        luzes,
        riscos,
      ].filter(Boolean).length;
    }
    return [riscos, estepe, som, luzes].filter(Boolean).length;
  };

  const checklistCount = getChecklistCount();
  const hasChecklist = combustivel || checklistCount > 0 || 
    eletricoState.voltagemBateria || eletricoState.cargaBateria;

  // Labels dinâmicos baseados no tipo de oficina
  const checklistLabel = isAutoEletrica ? "Checklist de Diagnóstico" : "Checklist de Entrada";
  const photosLabel = isAutoEletrica ? "Fotos do Diagnóstico" : "Fotos de Entrada";
  const photosHint = isAutoEletrica 
    ? "Registre fotos do scanner, diagrama elétrico e componentes"
    : "Toque para abrir a câmera";

  return (
    <div className="space-y-3">
      {/* Botão para abrir checklist */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full h-12 justify-between gap-2",
              hasChecklist && "border-success/50 bg-success/5"
            )}
          >
            <div className="flex items-center gap-2">
              {isAutoEletrica ? (
                <Zap className={cn(
                  "w-5 h-5",
                  hasChecklist ? "text-amber-500" : "text-muted-foreground"
                )} />
              ) : (
                <ClipboardList className={cn(
                  "w-5 h-5",
                  hasChecklist ? "text-success" : "text-muted-foreground"
                )} />
              )}
              <span className="font-medium">
                {checklistLabel}
              </span>
              {hasChecklist && (
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  isAutoEletrica 
                    ? "text-amber-600 bg-amber-500/10" 
                    : "text-success bg-success/10"
                )}>
                  {checklistCount} itens
                </span>
              )}
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3">
          <div className={cn(
            "space-y-4 p-4 rounded-xl border",
            isAutoEletrica 
              ? "bg-amber-500/5 border-amber-500/20" 
              : "bg-muted/30 border-border"
          )}>
            {/* Seleção do tipo de veículo - Oculto para Auto Elétrica */}
            {!isAutoEletrica && (
              <div className="space-y-2">
                <Label className="text-sm">Tipo de Veículo</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={tipoSelecionado === "carro" ? "default" : "outline"}
                    className={cn(
                      "h-11 gap-2",
                      tipoSelecionado === "carro" && "bg-primary"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTipoSelecionado("carro");
                    }}
                  >
                    <Car className="w-4 h-4" />
                    Carro
                  </Button>
                  <Button
                    type="button"
                    variant={tipoSelecionado === "moto" ? "default" : "outline"}
                    className={cn(
                      "h-11 gap-2",
                      tipoSelecionado === "moto" && "bg-primary"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTipoSelecionado("moto");
                    }}
                  >
                    <Bike className="w-4 h-4" />
                    Moto
                  </Button>
                </div>
              </div>
            )}

            {/* Conteúdo do checklist - só aparece após selecionar tipo */}
            {tipoSelecionado && (
              <>
                {/* Combustível - só para carro/moto */}
                {tipoSelecionado !== "eletrico" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm">Nível de Combustível</Label>
                    </div>
                    <Select value={combustivel} onValueChange={setCombustivel}>
                      <SelectTrigger className="w-full h-11">
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                      <SelectContent>
                        {combustivelOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              <span>{opt.icon}</span>
                              <span>{opt.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Toggle items específicos por tipo */}
                {renderChecklistItems()}
              </>
            )}

            {/* Mensagem quando nenhum tipo selecionado */}
            {!tipoSelecionado && !isAutoEletrica && (
              <div className="text-center py-3 text-muted-foreground text-sm">
                Selecione o tipo de veículo para ver o checklist
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Botão para fotos - separado */}
      <Collapsible open={showPhotos} onOpenChange={setShowPhotos}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full h-12 justify-between gap-2",
              fotos.length > 0 && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <Camera className={cn(
                "w-5 h-5",
                fotos.length > 0 ? "text-primary" : "text-muted-foreground"
              )} />
              <span className="font-medium">
                {photosLabel}
              </span>
              {fotos.length > 0 && (
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {fotos.length} foto(s)
                </span>
              )}
            </div>
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform",
              showPhotos && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3">
          <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
            {/* Photo Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {fotos.map((foto, index) => (
                <div key={index} className="relative group aspect-square">
                  <MediaThumbnail
                    src={resolveFotoUrl(foto)}
                    alt={`Foto ${index + 1}`}
                    className="rounded-xl border border-border"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeFoto(index);
                    }}
                    className="absolute -top-2 -right-2 min-w-[32px] min-h-[32px] w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Upload Button */}
              <label className="aspect-square border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 active:bg-primary/10 transition-all touch-manipulation">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImagePlus className="w-6 h-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground mt-1">
                      Adicionar
                    </span>
                  </>
                )}
              </label>
            </div>

            {/* Helper text */}
            <p className="text-xs text-muted-foreground text-center">
              📸 Anexe fotos e vídeos do veículo (máx 50MB por vídeo)
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
