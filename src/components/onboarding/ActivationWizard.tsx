import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, Car, Bike, Wrench, Check, 
  Sparkles, Zap, Phone, ArrowRight, Loader2, Trophy, Target, Rocket
} from "lucide-react";
import { useClientes } from "@/hooks/useClientes";
import { useVeiculos } from "@/hooks/useVeiculos";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { useOficina } from "@/contexts/OficinaContext";
import { useOficinaLabels } from "@/hooks/useOficinaLabels";
import { trackFunnelEvent } from "@/lib/funnelTracking";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const WIZARD_COMPLETED_PREFIX = "mechpro_wizard_completed_";

interface WizardData {
  clienteNome: string;
  clienteTelefone: string;
  veiculoMarca: string;
  veiculoModelo: string;
  veiculoPlaca: string;
  veiculoTipo: "carro" | "moto";
}

export function ActivationWizard() {
  const navigate = useNavigate();
  const { oficinaAtual } = useOficina();
  const { clientes } = useClientes();
  const { veiculos } = useVeiculos();
  const { ordens } = useOrdensServico();
  const { isAutoEletrica } = useOficinaLabels();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createdClienteId, setCreatedClienteId] = useState<string | null>(null);
  const { createCliente } = useClientes();
  const { createVeiculo } = useVeiculos();
  const [data, setData] = useState<WizardData>({
    clienteNome: "",
    clienteTelefone: "",
    veiculoMarca: "",
    veiculoModelo: "",
    veiculoPlaca: "",
    veiculoTipo: "carro",
  });

  const wizardCompletedKey = `${WIZARD_COMPLETED_PREFIX}${oficinaAtual?.id || "global"}`;

  useEffect(() => {
    if (!oficinaAtual) return;
    
    const completed = localStorage.getItem(wizardCompletedKey);
    
    // Show wizard if user has no OS yet — this is the real activation event
    const hasNoOS = !ordens || ordens.length === 0;
    
    if (!completed && hasNoOS) {
      setVisible(true);
      trackFunnelEvent({ event: "wizard_started", oficina_id: oficinaAtual.id });
    } else {
      setVisible(false);
    }
  }, [oficinaAtual, ordens?.length, wizardCompletedKey]);

  // Track wizard abandonment when user leaves the page
  useEffect(() => {
    if (!visible || !oficinaAtual?.id) return;
    const handleUnload = () => {
      trackFunnelEvent({ event: "wizard_abandoned", oficina_id: oficinaAtual.id, step: String(step), metadata: { had_data: !!data.clienteNome } });
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [visible, oficinaAtual?.id, step, data.clienteNome]);

  if (!visible) return null;

  // Auto-advance step based on existing data
  const effectiveStep = clientes.length > 0 && veiculos.length > 0 ? 1 : step;

  const handleStep1 = async () => {
    if (!data.clienteNome.trim()) {
      toast.error("Digite o nome do cliente");
      return;
    }
    if (!data.veiculoMarca.trim() || !data.veiculoModelo.trim()) {
      toast.error("Preencha marca e modelo do veículo");
      return;
    }
    setLoading(true);
    try {
      // Create client + vehicle in one step
      const result = await createCliente.mutateAsync({
        nome: data.clienteNome.trim(),
        telefone: data.clienteTelefone.trim() || undefined,
      });
      setCreatedClienteId(result.id);
      
      const veiculoResult = await createVeiculo.mutateAsync({
        cliente_id: result.id,
        marca: data.veiculoMarca.trim(),
        modelo: data.veiculoModelo.trim(),
        placa: data.veiculoPlaca.trim() || undefined,
        tipo: data.veiculoTipo,
      });
      
      toast.success("✅ Cliente e veículo cadastrados!");
      trackFunnelEvent({ event: "wizard_step_completed", oficina_id: oficinaAtual.id, step: "client_vehicle", entity_id: result.id });
      trackFunnelEvent({ event: "client_created", oficina_id: oficinaAtual.id, entity_id: result.id });
      trackFunnelEvent({ event: "vehicle_created", oficina_id: oficinaAtual.id, entity_id: veiculoResult.id });
      setStep(1);
    } catch {
      // error handled by hooks
    }
    setLoading(false);
  };

  const handleCreateOS = () => {
    localStorage.setItem(wizardCompletedKey, "true");
    trackFunnelEvent({ event: "first_os_started", oficina_id: oficinaAtual?.id || "" });
    setVisible(false);
    navigate("/servicos?nova=rapida");
    toast.success("Bora criar sua primeira OS! 🔥");
  };

  const progressPercent = effectiveStep === 0 ? 15 : 65;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <div className="relative rounded-2xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 via-card to-primary/5 shadow-lg overflow-hidden">
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-accent via-primary to-accent" />
        
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {effectiveStep === 0 ? "Comece aqui — leva 2 minutos" : "Quase lá! Crie sua 1ª OS"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {effectiveStep === 0 ? "Cadastre o primeiro cliente e veículo" : "O sistema começa a funcionar de verdade"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-accent/10 px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-bold text-accent">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-accent to-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "spring", stiffness: 100 }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pb-5">
          <AnimatePresence mode="wait">
            {effectiveStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Client fields */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Cliente
                    </Label>
                    <Input
                      placeholder="Nome do cliente *"
                      value={data.clienteNome}
                      onChange={(e) => setData(d => ({ ...d, clienteNome: e.target.value }))}
                      className="h-10"
                      onKeyDown={(e) => e.key === "Enter" && handleStep1()}
                    />
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Telefone (opcional)"
                        value={data.clienteTelefone}
                        onChange={(e) => setData(d => ({ ...d, clienteTelefone: e.target.value }))}
                        className="h-10 pl-9"
                        inputMode="tel"
                      />
                    </div>
                  </div>
                  
                  {/* Vehicle fields */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      {isAutoEletrica ? <Zap className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />} Veículo
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Marca *"
                        value={data.veiculoMarca}
                        onChange={(e) => setData(d => ({ ...d, veiculoMarca: e.target.value }))}
                        className="h-10"
                      />
                      <Input
                        placeholder="Modelo *"
                        value={data.veiculoModelo}
                        onChange={(e) => setData(d => ({ ...d, veiculoModelo: e.target.value }))}
                        className="h-10"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Placa (opcional)"
                        value={data.veiculoPlaca}
                        onChange={(e) => setData(d => ({ ...d, veiculoPlaca: e.target.value.toUpperCase() }))}
                        className="h-10 uppercase"
                      />
                      <Select 
                        value={data.veiculoTipo} 
                        onValueChange={(v) => setData(d => ({ ...d, veiculoTipo: v as "carro" | "moto" }))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="carro">Carro</SelectItem>
                          <SelectItem value="moto">Moto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleStep1} 
                  disabled={loading || !data.clienteNome.trim() || !data.veiculoMarca.trim() || !data.veiculoModelo.trim()}
                  className="w-full h-11 mt-4 bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-white font-semibold rounded-xl gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Salvar e criar minha 1ª OS
                </Button>
              </motion.div>
            )}

            {effectiveStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col sm:flex-row items-center gap-4"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.5 }}
                  className="w-14 h-14 rounded-full bg-success/15 border-2 border-success/30 flex items-center justify-center flex-shrink-0"
                >
                  <Trophy className="w-7 h-7 text-success" />
                </motion.div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg font-bold text-foreground">Cliente e veículo prontos! 🔥</h3>
                  <p className="text-sm text-muted-foreground">
                    Agora crie a primeira OS e veja o financeiro funcionando
                  </p>
                </div>
                <Button
                  onClick={handleCreateOS}
                  className="h-12 px-6 bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 text-white font-bold rounded-xl gap-2 shadow-lg shadow-success/25 whitespace-nowrap"
                >
                  <Wrench className="w-5 h-5" />
                  Criar minha 1ª OS
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
