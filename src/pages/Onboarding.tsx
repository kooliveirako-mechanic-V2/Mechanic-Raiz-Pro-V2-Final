import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOficina } from "@/contexts/OficinaContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Wrench, Building2, Phone, MapPin, Car, Bike, Loader2, Zap, Sparkles, Shield, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { trackSignupCompleted } from "@/lib/pixelEvents";
import { trackFunnelEvent } from "@/lib/funnelTracking";
import { supabase } from "@/integrations/supabase/client";

// Mapeamento tipo → plano + preço para contexto visual
const TIPO_PLANO_MAP: Record<string, { plano: string; preco: string }> = {
  moto: { plano: "Moto Pro", preco: "R$ 47,90/mês" },
  carro: { plano: "Carro Pro", preco: "R$ 67,90/mês" },
  auto_eletrica: { plano: "Carro Pro", preco: "R$ 67,90/mês" },
  ambos: { plano: "Oficina Completa", preco: "R$ 97,90/mês" },
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { oficinas, loading: oficinaLoading, initialized, createOficina } = useOficina();
  const [loading, setLoading] = useState(false);
  
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");

  // Ler plano selecionado na landing e pré-selecionar tipo correspondente
  const getInitialTipo = () => {
    const savedPlan = localStorage.getItem('selectedPlan');
    if (savedPlan === 'moto_pro') return 'moto';
    if (savedPlan === 'oficina_pro') return 'carro'; // carro_pro e oficina_completa → oficina_pro no backend
    return 'ambos';
  };
  const [tipo, setTipo] = useState(getInitialTipo);

  useEffect(() => {
    if (!authLoading && !oficinaLoading && initialized) {
      if (!user) {
        navigate("/auth", { replace: true });
      } else if (oficinas.length > 0) {
        navigate("/", { replace: true });
      }
    }
  }, [authLoading, oficinaLoading, initialized, user, oficinas, navigate]);

  if (authLoading || oficinaLoading || !initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (oficinas.length > 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Digite o nome da oficina");
      return;
    }
    setLoading(true);
    const { error, oficina_id } = await createOficina({
      nome: nome.trim(),
      telefone: telefone.trim() || undefined,
      endereco: endereco.trim() || undefined,
      tipo,
    });
    if (error) {
      toast.error("Erro ao criar oficina", { description: error.message });
    } else {
      toast.success("Oficina criada com sucesso! Você tem 14 dias de teste grátis.");
      trackSignupCompleted(tipo);
      localStorage.setItem("mechpro_trial_start", new Date().toISOString());
      trackFunnelEvent({ event: "signup_completed", oficina_id, metadata: { tipo } });

      // Sync lead (fire-and-forget)
      supabase.functions.invoke("sync-lead-on-signup", {
        body: { nome: nome.trim(), telefone: telefone.trim() || null, tipo },
      }).catch((err) => console.error("Sync lead error:", err));

      // Welcome email (fire-and-forget)
      supabase.functions.invoke("send-welcome-email", {
        body: { 
          email: user!.email, 
          nome: nome.trim(), 
          oficina: nome.trim(), 
          tipo 
        },
      }).catch((err) => console.error("Welcome email error:", err));

      // Persist phone (fire-and-forget)
      if (telefone.trim()) {
        supabase
          .from("profiles")
          .update({ telefone: telefone.trim() })
          .eq("user_id", user!.id)
          .then(({ error }) => {
            if (error) console.error("Error saving phone to profile:", error);
          });
      }

      // Limpar plano selecionado da landing
      localStorage.removeItem('selectedPlan');
      localStorage.removeItem('billingCycle');
      navigate("/");
    }
    setLoading(false);
  };

  const tipoOptions = [
    { value: "moto", label: "Motos", icon: Bike, desc: "Moto Pro · R$ 47,90/mês", color: "from-orange-500/20 to-orange-600/10 border-orange-500/30 hover:border-orange-400/60", activeColor: "from-orange-500/30 to-orange-600/20 border-orange-400 shadow-orange-500/20" },
    { value: "carro", label: "Carros", icon: Car, desc: "Carro Pro · R$ 67,90/mês", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-400/60", activeColor: "from-blue-500/30 to-blue-600/20 border-blue-400 shadow-blue-500/20" },
    { value: "auto_eletrica", label: "Auto Elétrica", icon: Zap, desc: "Carro Pro · R$ 67,90/mês", color: "from-amber-500/20 to-yellow-600/10 border-amber-500/30 hover:border-amber-400/60", activeColor: "from-amber-500/30 to-yellow-600/20 border-amber-400 shadow-amber-500/20" },
    { value: "ambos", label: "Carro + Moto", icons: [Car, Bike], desc: "Oficina Completa · R$ 97,90/mês", color: "from-cyan-500/20 to-blue-600/10 border-cyan-500/30 hover:border-cyan-400/60", activeColor: "from-cyan-500/30 to-blue-600/20 border-cyan-400 shadow-cyan-500/20" },
  ];

  const benefits = [
    { icon: Shield, text: "14 dias grátis" },
    { icon: Clock, text: "Pronto em 30s" },
    { icon: Sparkles, text: "Sem cartão" },
  ];

  const currentPlano = TIPO_PLANO_MAP[tipo];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Ambient background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-blue-600/5 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-orange-500/5 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Logo + Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="relative mb-5">
            <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-accent via-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-accent/30 p-4">
              <Wrench className="w-9 h-9 text-white" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-accent to-cyan-400 opacity-20 blur-lg" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Bem-vindo ao <span className="bg-gradient-to-r from-accent to-cyan-400 bg-clip-text text-transparent">Mechanic Raiz Pro</span>!
          </h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">
            Configure sua oficina e comece a faturar
          </p>

          {/* Benefits pills */}
          <div className="flex gap-3 mt-4">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50"
              >
                <b.icon className="w-3.5 h-3.5 text-accent" />
                {b.text}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/20 overflow-hidden"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2.5 mb-1">
              <Building2 className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-foreground">Dados da Oficina</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Preencha as informações básicas para começar
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-sm font-medium">Nome da Oficina <span className="text-accent">*</span></Label>
                <div className="relative group">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Ex: Oficina do João"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="pl-10 h-11 bg-background/50 border-border/60 focus:border-accent/60 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-sm font-medium">Telefone</Label>
                <div className="relative group">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                  <Input
                    id="telefone"
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="pl-10 h-11 bg-background/50 border-border/60 focus:border-accent/60 transition-all"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-2">
                <Label htmlFor="endereco" className="text-sm font-medium">Endereço</Label>
                <div className="relative group">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                  <Input
                    id="endereco"
                    type="text"
                    placeholder="Rua, número, bairro, cidade"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="pl-10 h-11 bg-background/50 border-border/60 focus:border-accent/60 transition-all"
                  />
                </div>
              </div>

              {/* Tipo de Oficina */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tipo de Oficina</Label>
                <RadioGroup value={tipo} onValueChange={setTipo} className="grid grid-cols-2 gap-2.5">
                  {tipoOptions.map((opt) => {
                    const isActive = tipo === opt.value;
                    return (
                      <Label
                        key={opt.value}
                        htmlFor={`tipo-${opt.value}`}
                        className="cursor-pointer"
                      >
                        <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} className="sr-only" />
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 bg-gradient-to-b ${
                            isActive
                              ? `${opt.activeColor} shadow-lg`
                              : `${opt.color} bg-background/30`
                          }`}
                        >
                          {opt.icons ? (
                            <div className="flex -space-x-1">
                              {opt.icons.map((Icon, i) => (
                                <Icon key={i} className={`w-5 h-5 ${isActive ? "text-foreground" : "text-muted-foreground"} transition-colors`} />
                              ))}
                            </div>
                          ) : (
                            <opt.icon className={`w-5 h-5 ${isActive ? "text-foreground" : "text-muted-foreground"} transition-colors`} />
                          )}
                          <span className={`text-xs font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"} transition-colors`}>
                            {opt.label}
                          </span>
                          <span className={`text-[9px] ${isActive ? "text-foreground/70" : "text-muted-foreground/60"} transition-colors text-center leading-tight`}>
                            {opt.desc}
                          </span>
                        </motion.div>
                      </Label>
                    );
                  })}
                </RadioGroup>
                
                {/* Contexto do plano selecionado */}
                <motion.p 
                  key={tipo}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-muted-foreground text-center"
                >
                  {tipo === "auto_eletrica"
                    ? "Som, alarme, injeção eletrônica e diagnóstico — incluso no Carro Pro"
                    : `Plano ${currentPlano.plano} · ${currentPlano.preco} após o teste grátis`}
                </motion.p>
              </div>

              {/* Submit */}
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  type="submit"
                  className="w-full h-12 bg-gradient-to-r from-accent to-blue-500 hover:from-accent/90 hover:to-blue-500/90 text-white font-semibold text-base rounded-xl shadow-lg shadow-accent/25 transition-all"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando oficina...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Começar a Usar — 14 dias grátis
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
