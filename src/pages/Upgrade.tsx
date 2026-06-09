import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  Check, 
  Zap, 
  Shield, 
  Clock, 
  AlertTriangle, 
  Bike, 
  Car, 
  Crown, 
  Sparkles, 
  ArrowRight,
  CheckCircle2,
  Star,
  FileText,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUpgradePlan } from "@/hooks/useUpgradePlan";
import { usePlan } from "@/hooks/usePlan";
import { MainLayout } from "@/components/layout/MainLayout";
import { useOficina } from "@/contexts/OficinaContext";
import { trackFunnelEvent } from "@/lib/funnelTracking";

// Preços — 3 planos
const PRICING = {
  moto_pro: {
    monthly: 47.90,
    annual: 479.00,
    annualMonthly: 39.90,
  },
  carro_pro: {
    monthly: 67.90,
    annual: 679.00,
    annualMonthly: 56.60,
  },
  oficina_completa: {
    monthly: 97.90,
    annual: 979.00,
    annualMonthly: 81.58,
  }
};

const PLANS = {
  moto_pro: {
    name: "Moto Pro",
    segment: "Oficinas de Moto",
    icon: Bike,
    tagline: "O nível mínimo para oficinas de moto que querem saber onde está a rentabilidade",
    ctaMonthly: "Assumir controle agora",
    ctaAnnual: "Garantir economia no anual",
    features: [
      "Gestão completa de clientes e veículos",
      "Diagnóstico com checklist, fotos e histórico",
      "Agenda que padroniza operação",
      "Estoque rastreado — zero perda",
      "Resultado real por serviço calculado",
      "Histórico técnico blindado",
      "Organização pré-fiscal",
      "No celular, tablet ou computador"
    ],
    gradient: "from-[#0077B6] to-[#00A8E8]",
    border: "border-[#0077B6]",
    text: "text-[#0077B6]",
    bg: "bg-[#0077B6]",
    iconBg: "from-[#0077B6] to-[#00A8E8]",
    shadow: "shadow-[#0077B6]/20"
  },
  carro_pro: {
    name: "Carro Pro",
    segment: "Oficinas de Carro",
    subtitle: "Mecânica + Auto Elétrica",
    icon: Car,
    tagline: "Controle total para oficinas de carro e auto elétrica. Enxerga rentabilidade de cada diagnóstico.",
    ctaMonthly: "Assumir controle agora",
    ctaAnnual: "Garantir economia no anual",
    showAutoEletrica: true,
    features: [
      "Gestão completa de clientes e veículos",
      "Diagnóstico com checklist, fotos e histórico",
      "Agenda que padroniza operação",
      "Estoque rastreado com NCM",
      "Resultado real por serviço calculado",
      "Dashboard com classificação de rentabilidade",
      "Organização pré-fiscal",
      "Relatórios e gráficos"
    ],
    autoEletrica: {
      title: "⚡ Auto Elétrica: inteligência inclusa",
      features: [
        "Alerta de diagnóstico subvalorizado",
        "Tempo técnico vs cobrança",
        "Histórico elétrico por veículo"
      ]
    },
    gradient: "from-[#6B21A8] to-[#9333EA]",
    border: "border-[#9333EA]",
    text: "text-[#6B21A8]",
    bg: "bg-[#6B21A8]",
    iconBg: "from-[#6B21A8] to-[#9333EA]",
    shadow: "shadow-[#9333EA]/20"
  },
  oficina_completa: {
    name: "Oficina Completa",
    segment: "Operação Completa",
    subtitle: "Motos + Carros + Auto Elétrica",
    icon: Crown,
    tagline: "O sistema definitivo para quem quer enxergar onde perde e onde ganha. Controle total, rentabilidade máxima.",
    ctaMonthly: "Quero operação completa",
    ctaAnnual: "Quero o melhor custo-benefício",
    isComplete: true,
    features: [
      { text: "✨ Tudo do Moto Pro", highlight: true },
      { text: "✨ Tudo do Carro Pro", highlight: true },
      "Financeiro avançado com DRE",
      "Dashboard com rentabilidade por diagnóstico",
      "Alertas de trabalho não cobrado",
      "Registro de módulos e sensores",
      "Histórico elétrico por veículo",
      "Classificação automática de resultado"
    ],
    autoEletrica: {
      title: "⚠️ Auto Elétrica: onde mais se perde sem processo",
      features: [
        "Detecta diagnóstico subvalorizado",
        "Tempo técnico vs valor — alerta automático",
        "Histórico elétrico rastreável"
      ]
    },
    gradient: "from-[#FF7A18] to-[#F59E0B]",
    border: "border-[#FF7A18]",
    text: "text-[#FF7A18]",
    bg: "bg-[#FF7A18]",
    iconBg: "from-[#FF7A18] to-[#F59E0B]",
    shadow: "shadow-[#FF7A18]/30"
  }
};

type PlanKey = keyof typeof PLANS;

export default function Upgrade() {
  const { isLoading, error, createUpgradePreference } = useUpgradePlan();
  const { 
    currentPlan, 
    isOficinaPro, 
    isTrialActive, 
    isTrialExpired,
    isPlanExpired,
    trialDaysRemaining
  } = usePlan();
  
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const isAnnual = billingCycle === 'annual';
  const { oficinaAtual } = useOficina();

  const trackedRef = useRef(false);
  useEffect(() => {
    if (oficinaAtual?.id && !trackedRef.current) {
      trackedRef.current = true;
      trackFunnelEvent({ event: "upgrade_page_viewed", oficina_id: oficinaAtual.id });
    }
  }, [oficinaAtual?.id]);

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',');
  };

  const handleUpgrade = async (plan: string) => {
    if (isLoading || selectedPlan) return;
    
    setSelectedPlan(plan);

    trackFunnelEvent({
      event: "checkout_started",
      oficina_id: oficinaAtual?.id || "",
      metadata: { plan, billing_cycle: billingCycle },
    });
    
    try {
      const preference = await createUpgradePreference(plan, billingCycle);
      
      if (preference?.init_point) {
        window.location.href = preference.init_point;
      } else {
        throw new Error('Preferência sem URL de pagamento');
      }
    } catch (err: any) {
      console.error('Erro no upgrade:', err);
      toast.error('Erro ao iniciar pagamento. Tente novamente.');
      setSelectedPlan(null);
    }
  };

  if (isOficinaPro && !isTrialActive) {
    return (
      <MainLayout>
        <div className="min-h-[80vh] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Você já é Oficina Completa! 🎉
            </h1>
            <p className="text-muted-foreground mb-6">
              Você tem acesso a todos os recursos da plataforma.
            </p>
            <Button variant="outline" onClick={() => window.history.back()}>
              Voltar
            </Button>
          </motion.div>
        </div>
      </MainLayout>
    );
  }

  const renderPlanCard = (planKey: PlanKey, index: number) => {
    const plan = PLANS[planKey];
    const IconComponent = plan.icon;
    const isPaidAndCurrent = currentPlan === planKey && !isTrialActive && !isTrialExpired && !isPlanExpired && isOficinaPro;
    const isComplete = planKey === "oficina_completa";
    const pricing = PRICING[planKey as keyof typeof PRICING];
    const currentPrice = isAnnual ? pricing.annual : pricing.monthly;
    const displayCta = isAnnual ? plan.ctaAnnual : plan.ctaMonthly;
    const hasAutoEletrica = 'autoEletrica' in plan;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 * index, type: "spring", stiffness: 200 }}
        className={`relative ${isComplete ? "lg:scale-[1.03] z-10" : ""}`}
      >
        {/* Glow effect */}
        <div className={`absolute -inset-1 bg-gradient-to-r ${plan.gradient} rounded-2xl blur-lg ${isComplete ? "opacity-50" : "opacity-20"}`} />
        
        <Card className={`h-full relative bg-white border-2 ${plan.border} rounded-2xl shadow-2xl ${plan.shadow} transition-all duration-500 overflow-hidden`}>
          
          {/* Badge Oficina Completa */}
          {isComplete && (
            <div className="absolute top-0 left-0 right-0">
              <div className="flex justify-center">
                <motion.div
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className={`bg-gradient-to-r ${plan.gradient} text-white text-xs font-bold px-5 py-2 rounded-b-xl shadow-lg flex items-center gap-2`}
                >
                  <Crown className="w-4 h-4" />
                  <span>OPERAÇÃO COMPLETA</span>
                </motion.div>
              </div>
            </div>
          )}

          {/* Badge para outros planos */}
          {!isComplete && (
            <div className="absolute top-0 left-0 right-0">
              <div className="flex justify-center">
                <div className={`bg-gradient-to-r ${plan.gradient} text-white text-xs font-bold px-4 py-1.5 rounded-b-xl shadow-lg`}>
                  {isAnnual ? "🎁 2 MESES GRÁTIS" : "14 DIAS GRÁTIS"}
                </div>
              </div>
            </div>
          )}

          {/* Badge Melhor Custo-Benefício */}
          {isComplete && (
            <motion.div 
              initial={{ rotate: 12 }}
              animate={{ rotate: [12, 15, 12] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-1 -right-1"
            >
              <div className="bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-900 text-[9px] font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl shadow-lg flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-600" />
                <span>MELHOR CUSTO-BENEFÍCIO</span>
              </div>
            </motion.div>
          )}

          <CardHeader className="p-4 sm:p-5 pt-8 sm:pt-10 pb-0">
            {/* Icon + Title */}
            <div className="flex items-center gap-2 mb-1">
              <motion.div 
                animate={isComplete ? { rotate: [0, 3, -3, 0] } : {}}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${plan.iconBg} shadow-lg`}
              >
                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h3 className={`text-base sm:text-lg font-black truncate ${isComplete ? `bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent` : 'text-slate-900'}`}>
                  {plan.name}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">
                  {plan.segment}
                </p>
              </div>
            </div>

            {/* Subtitle com ícones */}
            {'subtitle' in plan && (
              <div className="flex items-center gap-2 mt-2 mb-3">
                {isComplete ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                    <Bike className="w-4 h-4 text-[#0077B6]" />
                    <span>+</span>
                    <Car className="w-4 h-4 text-[#6B21A8]" />
                    <span>+</span>
                    <Zap className="w-4 h-4 text-amber-500" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{(plan as any).subtitle}</span>
                  </div>
                )}
              </div>
            )}

            {/* Preço */}
            <div className="mb-3">
              <motion.div
                key={billingCycle}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-slate-500 font-semibold">R$</span>
                  <span className={`text-3xl sm:text-4xl font-black ${plan.text}`}>
                    {formatPrice(currentPrice)}
                  </span>
                  <span className="text-slate-500 text-xs sm:text-sm">
                    /{isAnnual ? 'ano' : 'mês'}
                  </span>
                </div>
                
                {isAnnual && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-0.5"
                  >
                    <span className="text-[10px] sm:text-xs text-emerald-600 font-semibold">
                      ≈ R$ {formatPrice(pricing.annualMonthly)}/mês
                    </span>
                  </motion.div>
                )}
              </motion.div>
              
              {/* Trial Badge */}
              <motion.div
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="mt-2"
              >
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-[10px] sm:text-xs font-bold shadow-lg shadow-emerald-500/30">
                  <Sparkles className="w-3 h-3" />
                  14 DIAS GRÁTIS
                </div>
              </motion.div>
              
              <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">
                💰 1-2 serviços/mês já pagam o sistema
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-0">
            {/* Tagline */}
            <p className="text-xs sm:text-sm text-slate-600 mb-3 font-medium leading-snug line-clamp-2">
              {plan.tagline}
            </p>

            {/* Bloco Auto Elétrica */}
            {hasAutoEletrica && (
              <div className="mb-3 p-2 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] sm:text-xs font-bold text-amber-700 line-clamp-1">
                    {isComplete ? "Auto Elétrica inclusa" : "⚡ Auto Elétrica"}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {(plan as any).autoEletrica.features.slice(0, 2).map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-1 text-[10px] text-amber-700">
                      <CheckCircle2 className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                      <span className="line-clamp-1">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Features */}
            <ul className="space-y-2 mb-4">
              {plan.features.slice(0, 5).map((feature, idx) => {
                const featureText = typeof feature === 'string' ? feature : (feature as { text: string; highlight?: boolean }).text;
                const isHighlight = typeof feature === 'object' && feature !== null && (feature as { text: string; highlight?: boolean }).highlight;
                
                return (
                  <li key={idx} className="flex items-start gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${plan.bg}`}>
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </div>
                    <span className={`text-xs sm:text-sm text-slate-700 leading-tight ${isHighlight ? "font-bold" : ""}`}>
                      {featureText}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Disclaimer pré-fiscal */}
            <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 rounded-lg border border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <p className="text-[9px] sm:text-[10px] text-slate-500">
                Não emite nota. Organiza para quem emite.
              </p>
            </div>

            {/* CTA Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={() => handleUpgrade(planKey)}
                disabled={isLoading || isPaidAndCurrent}
                className={`w-full font-bold transition-all bg-gradient-to-r ${plan.gradient} hover:opacity-90 text-white shadow-xl ${plan.shadow} ${
                  isComplete ? "h-14 text-base" : "h-12 text-sm"
                }`}
              >
                {isLoading && selectedPlan === planKey ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processando...
                  </>
                ) : isPaidAndCurrent ? (
                  "Plano Ativo"
                ) : (
                  <>
                    <span>{displayCta}</span>
                    <ArrowRight className="ml-2 w-4 h-4 flex-shrink-0" />
                  </>
                )}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <MainLayout>
      <div className="min-h-[80vh] py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 via-white to-slate-50 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#0077B6]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FF7A18]/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Trial/Expired Banner */}
          {(isTrialExpired || isPlanExpired) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 rounded-xl flex items-center gap-3 bg-red-50 border border-red-200"
            >
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-900">Seu período de teste expirou</p>
                <p className="text-sm text-red-700">Ative um plano para continuar usando o sistema.</p>
              </div>
            </motion.div>
          )}

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-full mb-4">
              <Target className="w-4 h-4 text-[#0077B6]" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">NÍVEIS DE OPERAÇÃO</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-3 leading-tight">
              Em que nível está sua oficina?
            </h1>
            
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              Gestão não é custo. É o pré-requisito para crescer com controle.
            </p>

            {/* Trial badge */}
            {isTrialActive && !isTrialExpired && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-4"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-full shadow-sm">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium text-sm">
                    {trialDaysRemaining} {trialDaysRemaining === 1 ? "dia restante" : "dias restantes"} de teste grátis
                  </span>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-8"
          >
            <div className="bg-gray-100 p-1.5 rounded-full flex items-center gap-1">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  billingCycle === 'monthly' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === 'annual' 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Anual
                <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5">-2 meses</Badge>
              </button>
            </div>
          </motion.div>

          {/* Savings banner */}
          {isAnnual && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center mb-8"
            >
              <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-4 py-2 text-sm">
                <Sparkles className="w-4 h-4 mr-2 inline" />
                🎁 Economize até 2 meses no plano anual!
              </Badge>
            </motion.div>
          )}

          {/* Plan Cards — 3 planos */}
          <div className="grid md:grid-cols-3 gap-6 mb-10 items-stretch">
            {renderPlanCard("moto_pro", 0)}
            {renderPlanCard("oficina_completa", 1)}
            {renderPlanCard("carro_pro", 2)}
          </div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center"
            >
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-600 text-sm mt-1">
                Se o problema persistir, entre em contato com o suporte.
              </p>
            </motion.div>
          )}

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Pagamento seguro via Mercado Pago</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Cancele quando quiser</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Acesso imediato após pagamento</span>
            </div>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
