import { useState, useEffect } from "react";
import { validateFile, safeFileName } from "@/lib/uploadValidation";
import { FotoOSThumb } from "@/components/ui/foto-os";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Zap, Battery, Gauge, Cpu, PlugZap, CircuitBoard, Lightbulb, 
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, Check,
  X, Plus, Camera, Loader2, ImagePlus, FileCode, Brain
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos de dados do DVI Elétrico
export interface ElectricDVIData {
  // Step 1: Bateria
  voltagemBateria: string;
  cargaBateria: string;
  bateriaStatus: "normal" | "atencao" | "critico" | "";
  
  // Step 2: Sistema de Carga
  alternadorOk: boolean;
  alternadorVoltagem: string;
  alternadorStatus: "normal" | "atencao" | "critico" | "";
  
  // Step 3: Sistema de Partida
  motorPartidaOk: boolean;
  motorPartidaAmperagem: string;
  motorPartidaStatus: "normal" | "atencao" | "critico" | "";
  
  // Step 4: Sistema Elétrico
  fusiveisOk: boolean;
  relesOk: boolean;
  iluminacaoOk: boolean;
  
  // Step 5: Códigos OBD
  codigosObd: string[];
  modulosTestados: string[];
  
  // Step 6: Hipótese (obrigatório)
  hipoteseDiagnostico: string;
  tempoDiagnosticoMinutos: number;
  
  // Fotos
  fotos: string[];
}

interface ElectricDVIWizardProps {
  data: ElectricDVIData;
  onChange: (data: ElectricDVIData) => void;
  ordemId?: string;
  veiculoId?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  requiredHipotese?: boolean;
}

const STEPS = [
  { id: 1, title: "Bateria", icon: Battery, description: "Voltagem e carga" },
  { id: 2, title: "Alternador", icon: Cpu, description: "Sistema de carga" },
  { id: 3, title: "Partida", icon: PlugZap, description: "Motor de arranque" },
  { id: 4, title: "Elétrico", icon: CircuitBoard, description: "Fusíveis e relés" },
  { id: 5, title: "OBD", icon: FileCode, description: "Códigos de falha" },
  { id: 6, title: "Hipótese", icon: Brain, description: "Diagnóstico final" },
];

// Referências técnicas
const VOLTAGE_REFERENCES = {
  bateria: { 
    critico: { min: 0, max: 11.5, label: "< 11.5V", color: "destructive" },
    atencao: { min: 11.5, max: 12.2, label: "11.5-12.2V", color: "warning" },
    normal: { min: 12.2, max: 12.8, label: "12.2-12.8V", color: "success" },
    excelente: { min: 12.8, max: 14, label: "> 12.8V", color: "success" },
  },
  alternador: {
    critico: { min: 0, max: 13.5, label: "< 13.5V", color: "destructive" },
    atencao: { min: 13.5, max: 13.8, label: "13.5-13.8V", color: "warning" },
    normal: { min: 13.8, max: 14.4, label: "13.8-14.4V", color: "success" },
    alto: { min: 14.4, max: 20, label: "> 14.4V", color: "warning" },
  },
  partida: {
    normal: { min: 0, max: 200, label: "< 200A", color: "success" },
    atencao: { min: 200, max: 300, label: "200-300A", color: "warning" },
    critico: { min: 300, max: 1000, label: "> 300A", color: "destructive" },
  }
};

const COMMON_OBD_CODES = [
  { code: "P0300", desc: "Falha de ignição aleatória" },
  { code: "P0301", desc: "Cilindro 1 - Falha de ignição" },
  { code: "P0420", desc: "Catalisador abaixo do limite" },
  { code: "P0171", desc: "Sistema muito pobre (Banco 1)" },
  { code: "P0174", desc: "Sistema muito pobre (Banco 2)" },
  { code: "P0442", desc: "Vazamento no sistema EVAP" },
  { code: "B1000", desc: "Falha no módulo ECU" },
  { code: "U0100", desc: "Perda comunicação com ECM" },
  { code: "C0035", desc: "Sensor roda ABS - Falha" },
];

const COMMON_MODULES = [
  "ECU/ECM", "BCM", "ABS", "Airbag", "TCM", "IPC/Painel", 
  "HVAC/AC", "Audio/Multimídia", "Gateway", "EPS/Direção"
];

// Componente de Status Visual
function StatusIndicator({ 
  status, 
  showLabel = true 
}: { 
  status: "normal" | "atencao" | "critico" | ""; 
  showLabel?: boolean;
}) {
  const config = {
    normal: { color: "bg-success", label: "Normal", icon: Check },
    atencao: { color: "bg-warning", label: "Atenção", icon: AlertTriangle },
    critico: { color: "bg-destructive", label: "Crítico", icon: X },
    "": { color: "bg-muted", label: "Não testado", icon: null },
  };

  const { color, label, icon: Icon } = config[status];

  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-3 h-3 rounded-full animate-pulse", color)} />
      {showLabel && <span className="text-xs text-muted-foreground">{label}</span>}
      {Icon && <Icon className={cn("w-3 h-3", 
        status === "normal" && "text-success",
        status === "atencao" && "text-warning",
        status === "critico" && "text-destructive"
      )} />}
    </div>
  );
}

// Componente de Voltagem com referência técnica
function VoltageInput({ 
  value, 
  onChange, 
  type,
  onStatusChange,
}: { 
  value: string; 
  onChange: (v: string) => void;
  type: "bateria" | "alternador";
  onStatusChange: (status: "normal" | "atencao" | "critico" | "") => void;
}) {
  const refs = VOLTAGE_REFERENCES[type];
  
  const getStatus = (v: number): "normal" | "atencao" | "critico" | "" => {
    if (!v) return "";
    if (v < refs.critico.max) return "critico";
    if (v < refs.atencao.max) return "atencao";
    if (v <= refs.normal.max) return "normal";
    return type === "alternador" ? "atencao" : "normal";
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    onStatusChange(getStatus(parseFloat(v) || 0));
  };

  const numValue = parseFloat(value) || 0;
  const status = getStatus(numValue);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="12.6"
            value={value}
            onChange={handleChange}
            className={cn(
              "h-12 text-lg font-mono pr-8",
              status === "normal" && "border-success focus:ring-success",
              status === "atencao" && "border-warning focus:ring-warning",
              status === "critico" && "border-destructive focus:ring-destructive"
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">V</span>
        </div>
        <StatusIndicator status={status} />
      </div>
      
      {/* Referência técnica */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(refs).map(([key, ref]) => (
          <Badge 
            key={key} 
            variant="outline" 
            className={cn(
              "text-[10px]",
              key === "critico" && "border-destructive/50 text-destructive",
              key === "atencao" && "border-warning/50 text-warning",
              key === "normal" && "border-success/50 text-success",
              key === "excelente" && "border-success/50 text-success",
              key === "alto" && "border-warning/50 text-warning"
            )}
          >
            {ref.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function ElectricDVIWizard({
  data,
  onChange,
  ordemId,
  isOpen = false,
  onOpenChange,
  requiredHipotese = true,
}: ElectricDVIWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [newObdCode, setNewObdCode] = useState("");
  const [expanded, setExpanded] = useState(isOpen);

  useEffect(() => {
    setExpanded(isOpen);
  }, [isOpen]);

  const handleExpandChange = (open: boolean) => {
    setExpanded(open);
    onOpenChange?.(open);
  };

  // Calcular progresso
  const calculateProgress = () => {
    let filled = 0;
    let total = 6;
    
    if (data.voltagemBateria || data.cargaBateria) filled++;
    if (data.alternadorOk || data.alternadorVoltagem) filled++;
    if (data.motorPartidaOk || data.motorPartidaAmperagem) filled++;
    if (data.fusiveisOk || data.relesOk || data.iluminacaoOk) filled++;
    if (data.codigosObd.length > 0 || data.modulosTestados.length > 0) filled++;
    if (data.hipoteseDiagnostico) filled++;
    
    return (filled / total) * 100;
  };

  // Handlers de upload
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

        // Persiste o path relativo; a leitura usa URL assinada.
        newFotos.push(filePath);
      }

      if (newFotos.length > 0) {
        onChange({ ...data, fotos: [...data.fotos, ...newFotos] });
        toast.success(`${newFotos.length} foto(s) adicionada(s)!`);
      }
    } catch (error) {
      console.error("Error uploading:", error);
      toast.error("Erro ao fazer upload das fotos");
    } finally {
      setUploading(false);
    }
  };

  const removeFoto = (index: number) => {
    onChange({ ...data, fotos: data.fotos.filter((_, i) => i !== index) });
  };

  // Adicionar código OBD
  const addObdCode = (code: string) => {
    if (code && !data.codigosObd.includes(code)) {
      onChange({ ...data, codigosObd: [...data.codigosObd, code] });
    }
    setNewObdCode("");
  };

  const removeObdCode = (code: string) => {
    onChange({ ...data, codigosObd: data.codigosObd.filter((c) => c !== code) });
  };

  // Toggle módulo testado
  const toggleModulo = (modulo: string) => {
    const newModulos = data.modulosTestados.includes(modulo)
      ? data.modulosTestados.filter((m) => m !== modulo)
      : [...data.modulosTestados, modulo];
    onChange({ ...data, modulosTestados: newModulos });
  };

  // Verificar se pode finalizar
  const canComplete = !requiredHipotese || data.hipoteseDiagnostico.trim().length > 0;

  // Contador de dados preenchidos
  const getFilledCount = () => {
    let count = 0;
    if (data.voltagemBateria) count++;
    if (data.alternadorVoltagem) count++;
    if (data.motorPartidaAmperagem) count++;
    if (data.fusiveisOk || data.relesOk || data.iluminacaoOk) count++;
    if (data.codigosObd.length > 0) count++;
    if (data.hipoteseDiagnostico) count++;
    return count;
  };

  // Renderizar step atual com tratamento de erro
  const renderStep = () => {
    try {
      switch (currentStep) {
      case 1: // Bateria
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Battery className="w-5 h-5" />
              <h3 className="font-semibold">Teste de Bateria</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Voltagem da Bateria (em repouso)</Label>
                <VoltageInput
                  value={data.voltagemBateria}
                  onChange={(v) => onChange({ ...data, voltagemBateria: v })}
                  type="bateria"
                  onStatusChange={(s) => onChange({ ...data, bateriaStatus: s })}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Medir com o veículo desligado há pelo menos 30 minutos
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Carga da Bateria (%)</Label>
                <div className="grid grid-cols-4 gap-2">
                  {["0-25", "25-50", "50-75", "75-100"].map((range) => (
                    <Button
                      key={range}
                      type="button"
                      variant={data.cargaBateria === range ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-10",
                        data.cargaBateria === range && 
                        (range === "0-25" ? "bg-destructive" : 
                         range === "25-50" ? "bg-warning" : 
                         range === "50-75" ? "bg-success/80" : "bg-success")
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onChange({ ...data, cargaBateria: range });
                      }}
                    >
                      {range === "0-25" ? "🔴" : range === "25-50" ? "🟠" : range === "50-75" ? "🟡" : "🟢"} {range}%
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Alternador
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Cpu className="w-5 h-5" />
              <h3 className="font-semibold">Sistema de Carga (Alternador)</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Voltagem com Motor Ligado</Label>
                <VoltageInput
                  value={data.alternadorVoltagem}
                  onChange={(v) => onChange({ ...data, alternadorVoltagem: v })}
                  type="alternador"
                  onStatusChange={(s) => onChange({ ...data, alternadorStatus: s })}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Medir com motor em marcha lenta (800-1000 RPM)
                </p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">Alternador funcionando corretamente?</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={data.alternadorOk === true ? "default" : "outline"}
                    size="sm"
                    className={cn(data.alternadorOk && "bg-success")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange({ ...data, alternadorOk: true });
                    }}
                  >
                    <Check className="w-4 h-4 mr-1" /> OK
                  </Button>
                  <Button
                    type="button"
                    variant={data.alternadorOk === false ? "default" : "outline"}
                    size="sm"
                    className={cn(data.alternadorOk === false && "bg-destructive")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange({ ...data, alternadorOk: false });
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> Defeito
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 3: // Motor de Partida
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <PlugZap className="w-5 h-5" />
              <h3 className="font-semibold">Motor de Partida</h3>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Amperagem de Partida (A)</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      placeholder="150"
                      value={data.motorPartidaAmperagem}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = parseInt(v) || 0;
                        const status = num < 200 ? "normal" : num < 300 ? "atencao" : "critico";
                        onChange({ 
                          ...data, 
                          motorPartidaAmperagem: v,
                          motorPartidaStatus: v ? status : ""
                        });
                      }}
                      className={cn(
                        "h-12 text-lg font-mono pr-8",
                        data.motorPartidaStatus === "normal" && "border-success",
                        data.motorPartidaStatus === "atencao" && "border-warning",
                        data.motorPartidaStatus === "critico" && "border-destructive"
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">A</span>
                  </div>
                  <StatusIndicator status={data.motorPartidaStatus} />
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline" className="text-[10px] border-success/50 text-success">{"< 200A"}</Badge>
                  <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">200-300A</Badge>
                  <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">{"> 300A"}</Badge>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <PlugZap className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm">Motor de partida OK?</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={data.motorPartidaOk === true ? "default" : "outline"}
                    size="sm"
                    className={cn(data.motorPartidaOk && "bg-success")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange({ ...data, motorPartidaOk: true });
                    }}
                  >
                    <Check className="w-4 h-4 mr-1" /> OK
                  </Button>
                  <Button
                    type="button"
                    variant={data.motorPartidaOk === false ? "default" : "outline"}
                    size="sm"
                    className={cn(data.motorPartidaOk === false && "bg-destructive")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange({ ...data, motorPartidaOk: false });
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> Defeito
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Sistema Elétrico
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <CircuitBoard className="w-5 h-5" />
              <h3 className="font-semibold">Sistema Elétrico</h3>
            </div>
            
            <div className="space-y-3">
              {[
                { key: "fusiveisOk", icon: CircuitBoard, label: "Fusíveis OK" },
                { key: "relesOk", icon: Zap, label: "Relés OK" },
                { key: "iluminacaoOk", icon: Lightbulb, label: "Iluminação OK" },
              ].map(({ key, icon: Icon, label }) => (
                <div 
                  key={key}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl border transition-all",
                    data[key as keyof ElectricDVIData] 
                      ? "bg-success/5 border-success/30" 
                      : "bg-muted/30 border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn(
                      "w-5 h-5",
                      data[key as keyof ElectricDVIData] ? "text-success" : "text-muted-foreground"
                    )} />
                    <Label className="text-sm font-medium">{label}</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={(data[key as keyof ElectricDVIData] as boolean) === true ? "default" : "outline"}
                      size="sm"
                      className={cn((data[key as keyof ElectricDVIData] as boolean) && "bg-success")}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onChange({ ...data, [key]: true });
                      }}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={(data[key as keyof ElectricDVIData] as boolean) === false ? "default" : "outline"}
                      size="sm"
                      className={cn((data[key as keyof ElectricDVIData] as boolean) === false && "bg-destructive")}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onChange({ ...data, [key]: false });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 5: // Códigos OBD
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <FileCode className="w-5 h-5" />
              <h3 className="font-semibold">Códigos OBD / Módulos</h3>
            </div>
            
            <div className="space-y-4">
              {/* Input para adicionar código */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: P0301, B1234..."
                  value={newObdCode}
                  onChange={(e) => setNewObdCode(e.target.value.toUpperCase())}
                  className="h-11 font-mono"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      addObdCode(newObdCode);
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon"
                  className="h-11 w-11"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addObdCode(newObdCode);
                  }}
                  disabled={!newObdCode}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Códigos adicionados */}
              {data.codigosObd.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.codigosObd.map((code) => (
                    <Badge 
                      key={code} 
                      variant="secondary" 
                      className="gap-1 font-mono text-sm py-1 px-2"
                    >
                      {code}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeObdCode(code);
                        }}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Códigos comuns */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Códigos Comuns:</Label>
                <div className="flex flex-wrap gap-1">
                  {COMMON_OBD_CODES.slice(0, 5).map(({ code, desc }) => (
                    <Button
                      key={code}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs font-mono"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        addObdCode(code);
                      }}
                      disabled={data.codigosObd.includes(code)}
                      title={desc}
                    >
                      {code}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Módulos Testados */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-medium">Módulos Testados</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_MODULES.map((modulo) => (
                    <Button
                      key={modulo}
                      type="button"
                      variant={data.modulosTestados.includes(modulo) ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 text-xs",
                        data.modulosTestados.includes(modulo) && "bg-primary"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleModulo(modulo);
                      }}
                    >
                      {modulo}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 6: // Hipótese de Diagnóstico
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Brain className="w-5 h-5" />
              <h3 className="font-semibold">Hipótese de Diagnóstico</h3>
              {requiredHipotese && <Badge variant="destructive" className="text-[10px]">Obrigatório</Badge>}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Qual a sua hipótese para o problema?
                </Label>
                <Textarea
                  placeholder="Ex: Bateria fraca devido ao alternador não estar carregando corretamente. Verificar correia do alternador e escovas..."
                  value={data.hipoteseDiagnostico}
                  onChange={(e) => onChange({ ...data, hipoteseDiagnostico: e.target.value })}
                  rows={4}
                  className={cn(
                    "resize-none",
                    requiredHipotese && !data.hipoteseDiagnostico && "border-warning"
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Descreva a causa provável e os próximos passos do diagnóstico
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tempo de Diagnóstico (minutos)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="30"
                  value={data.tempoDiagnosticoMinutos || ""}
                  onChange={(e) => onChange({ 
                    ...data, 
                    tempoDiagnosticoMinutos: parseInt(e.target.value) || 0 
                  })}
                  className="h-11"
                />
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
    } catch (error) {
      console.error("Erro ao renderizar step do DVI Elétrico:", error);
      return (
        <div className="p-4 text-center text-muted-foreground">
          <p>Erro ao carregar etapa. Tente voltar e avançar novamente.</p>
        </div>
      );
    }
  };

  const progress = calculateProgress();
  const filledCount = getFilledCount();

  return (
    <Collapsible open={expanded} onOpenChange={handleExpandChange}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            "w-full h-14 justify-between gap-2 mb-2",
            filledCount > 0 && "border-amber-500/50 bg-amber-500/5"
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              filledCount > 0 ? "bg-amber-500/20" : "bg-muted"
            )}>
              <Zap className={cn(
                "w-5 h-5",
                filledCount > 0 ? "text-amber-500" : "text-muted-foreground"
              )} />
            </div>
            <div className="text-left">
              <span className="font-semibold block">Diagnóstico Elétrico</span>
              <span className="text-xs text-muted-foreground">
                {filledCount > 0 ? `${filledCount}/6 etapas preenchidas` : "Clique para iniciar o checklist"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {filledCount > 0 && (
              <div className="w-16">
                <Progress value={progress} className="h-2" />
              </div>
            )}
            <ChevronDown className={cn(
              "w-5 h-5 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )} />
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-4 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl space-y-4">
          {/* Progress e Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium text-amber-500">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            {/* Step indicators */}
            <div className="flex justify-between overflow-x-auto pb-2 gap-1">
              {STEPS.map((step) => {
                const StepIcon = step.icon;
                const isActive = currentStep === step.id;
                const isComplete = currentStep > step.id;
                
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentStep(step.id);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all min-w-[60px]",
                      isActive && "bg-amber-500/20",
                      !isActive && "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      isActive && "bg-amber-500 text-white",
                      isComplete && "bg-success text-white",
                      !isActive && !isComplete && "bg-muted text-muted-foreground"
                    )}>
                      {isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                    </div>
                    <span className={cn(
                      "text-[10px] whitespace-nowrap",
                      isActive ? "text-amber-500 font-medium" : "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="min-h-[200px]">
            {renderStep()}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-2 border-t border-amber-500/20">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentStep(Math.max(1, currentStep - 1));
              }}
              disabled={currentStep === 1}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>

            {currentStep < 6 ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentStep(currentStep + 1);
                }}
                className="gap-1 bg-amber-500 hover:bg-amber-600"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleExpandChange(false);
                }}
                disabled={!canComplete}
                className={cn(
                  "gap-1",
                  canComplete ? "bg-success hover:bg-success/90" : "bg-muted"
                )}
              >
                <Check className="w-4 h-4" /> Concluir
              </Button>
            )}
          </div>

          {/* Fotos */}
          <div className="pt-3 border-t border-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Fotos do Diagnóstico
              </Label>
              {data.fotos.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {data.fotos.length} foto(s)
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {data.fotos.map((foto, index) => (
                <div key={index} className="relative group aspect-square">
                  {foto ? (
                    <FotoOSThumb
                      foto={foto}
                      alt={`Foto ${index + 1}`}
                      className="rounded-lg border"
                    />
                  ) : (
                    <div className="w-full h-full rounded-lg border bg-muted flex items-center justify-center">
                      <ImagePlus className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeFoto(index);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              <label className="aspect-square border-2 border-dashed border-amber-500/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-500/5 transition-all">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5 text-amber-500/50" />
                    <span className="text-[10px] text-amber-500/50 mt-1">Adicionar</span>
                  </>
                )}
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              📸 Registre fotos do scanner, diagrama e componentes
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Função helper para criar dados iniciais
export function createEmptyElectricDVIData(): ElectricDVIData {
  return {
    voltagemBateria: "",
    cargaBateria: "",
    bateriaStatus: "",
    alternadorOk: false,
    alternadorVoltagem: "",
    alternadorStatus: "",
    motorPartidaOk: false,
    motorPartidaAmperagem: "",
    motorPartidaStatus: "",
    fusiveisOk: false,
    relesOk: false,
    iluminacaoOk: false,
    codigosObd: [],
    modulosTestados: [],
    hipoteseDiagnostico: "",
    tempoDiagnosticoMinutos: 0,
    fotos: [],
  };
}
