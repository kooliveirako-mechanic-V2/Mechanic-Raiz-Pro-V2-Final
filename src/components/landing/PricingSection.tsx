import React, { forwardRef, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Bike, 
  Car, 
  Crown,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Star,
  Zap,
  FileText,
  Target
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trackEvent } from "@/lib/tracking";

interface PricingSectionProps {
  onScrollToSignup: () => void;
}

// Salva plano selecionado para redirect pós-signup
const saveSelectedPlan = (planType: 'moto_pro' | 'carro_pro' | 'oficina_completa', billingCycle: 'monthly' | 'annual') => {
  // Backend mapping: carro_pro and oficina_completa → oficina_pro
  const backendPlan = planType === 'moto_pro' ? 'moto_pro' : 'oficina_pro';
  localStorage.setItem('selectedPlan', backendPlan);
  localStorage.setItem('billingCycle', billingCycle);
};

// Preços conforme especificação — 3 planos
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

// Configuração dos 3 planos
const PLANS = {
  moto_pro: {
    name: "Moto Pro",
    segment: "Oficinas de Moto",
    icon: Bike,
    tagline: "Controle completo para oficinas de moto. Nunca mais perca serviço, saiba se está lucrando.",
    ctaMonthly: "Quero controlar minha oficina — 14 dias grátis",
    ctaAnnual: "Quero controlar minha oficina — 14 dias grátis",
    features: [
      "Cadastre clientes e motos em 1 minuto",
      "OS com histórico blindado — prova tudo",
      "Saiba exatamente o lucro de cada serviço",
      "Estoque rastreado — sem perda de peça",
      "Fotos de entrada protegem você",
      "Agenda que padroniza operação",
      "Relatórios simples de financeiro",
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
    tagline: "Para oficinas de carro e auto elétrica. Controle completo, sabe exatamente o lucro de cada diagnóstico.",
    ctaMonthly: "Quero controlar minha oficina — 14 dias grátis",
    ctaAnnual: "Quero controlar minha oficina — 14 dias grátis",
    showAutoEletrica: true,
    features: [
      "Cadastre clientes e carros em 1 minuto",
      "OS com histórico — cliente não discute mais",
      "Diagnóstico rastreável: fotos, checklist, tudo",
      "Estoque com NCM — sistema já pré-organizado",
      "Saiba o lucro de cada serviço na hora",
      "Dashboard que mostra quem lucra e quem não",
      "Financeiro organizado (pronto para contador)",
      "Relatórios que fazem sentido"
    ],
    autoEletrica: {
      title: "⚡ Auto Elétrica: inteligência inclusa",
      features: [
        "Alerta quando diagnóstico está sendo cobrado barato",
        "Mostra quanto tempo técnico vale",
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
    tagline: "Tudo junto: Moto + Carro + Elétrica. Vê lucro real em cada OS. O plano para oficinas que querem crescer.",
    ctaMonthly: "Quero controlar minha oficina — 14 dias grátis",
    ctaAnnual: "Quero controlar minha oficina — 14 dias grátis",
    isComplete: true,
    features: [
      { text: "✨ Moto Pro + Carro Pro completos", highlight: true },
      "🔴 Detecta quando diagnóstico está subvalorizado",
      "📊 Financeiro simplificado (não é confuso)",
      "🏆 Sabe qual cliente dá lucro ou prejuízo",
      "⚡ Histórico elétrico rastreável por veículo",
      "🎯 Sistema avisa antes de cobrar errado"
    ],
    autoEletrica: {
      title: "⚠️ Auto Elétrica: O lugar onde mais se perde",
      features: [
        "Detecta quando diagnóstico foi cobrado barato",
        "Mostra quando você gasta 2h e cobra R$ 80",
        "Histórico elétrico salvo por veículo"
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

export const PricingSection = forwardRef<HTMLElement, PricingSectionProps>(({ onScrollToSignup }, ref) => {
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const isAnnual = billingCycle === 'annual';
  const localSectionRef = useRef<HTMLElement | null>(null);

  // [Fase 1c] view_plans com IntersectionObserver — 1x por sessão.
  // Dispara quando ≥50% da seção fica visível por ≥1s. Mapeia para Meta ViewContent
  // e MOCapi ViewContent (via EVENT_NAME_MAP em tracking.ts).
  useEffect(() => {
    const SESSION_FLAG = "mrp_view_plans_fired";
    try {
      if (sessionStorage.getItem(SESSION_FLAG)) return;
    } catch {}

    const target = localSectionRef.current || document.getElementById("planos");
    if (!target) return;

    let visibleTimer: ReturnType<typeof setTimeout> | null = null;
    let fired = false;

    const fire = () => {
      if (fired) return;
      fired = true;
      try { sessionStorage.setItem(SESSION_FLAG, "1"); } catch {}
      try {
        trackEvent("view_plans", {
          params: {
            section_name: "pricing",
            content_name: "planos",
            content_category: "pricing",
            content_type: "pricing_section",
          },
        });
      } catch {}
      observer.disconnect();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!visibleTimer) visibleTimer = setTimeout(fire, 1000);
        } else {
          if (visibleTimer) { clearTimeout(visibleTimer); visibleTimer = null; }
        }
      },
      { threshold: [0, 0.5, 1] }
    );

    observer.observe(target);
    return () => {
      if (visibleTimer) clearTimeout(visibleTimer);
      observer.disconnect();
    };
  }, []);
  
  // Mapa plano → slug usado na URL (para rastreamento por URL no Meta/GA4)
  const PLAN_URL_SLUG: Record<'moto_pro' | 'carro_pro' | 'oficina_completa', string> = {
    moto_pro: 'moto',
    carro_pro: 'carro',
    oficina_completa: 'oficina',
  };

  const handlePlanSelect = (planType: 'moto_pro' | 'carro_pro' | 'oficina_completa') => {
    saveSelectedPlan(planType, billingCycle);

    // 🔑 Atualiza a URL com ?plano=... + ciclo, preservando UTMs existentes.
    // Permite configurar eventos no Meta Event Setup Tool e GA4 por "URL contém".
    try {
      const slug = PLAN_URL_SLUG[planType];
      const params = new URLSearchParams(window.location.search);
      params.set('plano', slug);
      params.set('ciclo', billingCycle === 'annual' ? 'anual' : 'mensal');
      
      // Usa navigate do react-router-dom para garantir que o ciclo de vida do React acompanhe a mudança.
      navigate({
        pathname: window.location.pathname,
        search: params.toString()
      }, { replace: true });
      
      // [Fase I] Disparo fbq direto removido — Meta Pixel agora é alimentado
      // exclusivamente pelo GTM via dataLayer (trackEvent select_plan abaixo).
    } catch {
      // não bloqueia o fluxo
    }

    // Fase 1b: trackEvent('select_plan') = dataLayer + Pixel(InitiateCheckout) + MOCapi(InitiateCheckout),
    // mesmo event_id (Meta dedupa). UTMs/first-touch já vêm via getTrackingContext().
    try {
      const ctaName = `plano_${planType}`;
      const selectedPricing = PRICING[planType];
      const selectedPrice = billingCycle === 'annual' ? selectedPricing.annual : selectedPricing.monthly;
      trackEvent('select_plan', {
        // [Fase F] Dedup: 1 disparo por plano+ciclo POR SESSÃO (Infinity TTL).
        dedupKey: `select_plan:${planType}:${billingCycle}`,
        dedupTtlMs: Number.POSITIVE_INFINITY,
        params: {
          plan_name: planType,
          plan_id: planType,
          plan_price: selectedPrice,
          plan_period: billingCycle,
          trial: true,
          trial_days: 14,
          content_name: ctaName,
          content_ids: [planType],
          content_category: 'pricing',
          content_type: 'plan_select',
          value: selectedPrice,
          currency: 'BRL',
          utm_content: ctaName,
          moc_cta: ctaName,
          page_url: window.location.href,
        },
      });
    } catch {
      // nunca bloquear o scroll
    }

    onScrollToSignup();
  };

  const formatPrice = (price: number) => {
    return price.toFixed(2).replace('.', ',');
  };

  const renderPlanCard = (planKey: string, plan: typeof PLANS.moto_pro, index: number) => {
    const IconComponent = plan.icon;
    const isComplete = planKey === "oficina_completa";
    const pricing = PRICING[planKey as keyof typeof PRICING];
    const currentPrice = isAnnual ? pricing.annual : pricing.monthly;
    const hasAutoEletrica = 'autoEletrica' in plan;

    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 * index, type: "spring", stiffness: 200 }}
        viewport={{ once: true }}
        className={`relative w-full max-w-[340px] lg:max-w-none lg:flex-1 ${isComplete ? "lg:scale-[1.03] z-10" : ""}`}
        style={{ touchAction: 'pan-y' }}
      >
        {/* Glow effect */}
        <div className={`absolute -inset-1 bg-gradient-to-r ${plan.gradient} rounded-2xl blur-lg ${isComplete ? "opacity-50" : "opacity-20"}`} />
        
        <div className={`h-full relative bg-white border-2 ${plan.border} rounded-2xl shadow-2xl ${plan.shadow} transition-all duration-500 overflow-hidden`}>
          
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

          <div className="p-5 sm:p-6 pt-10 sm:pt-12">
            {/* Icon + Title */}
            <div className="flex items-center gap-3 mb-1">
              <motion.div 
                animate={isComplete ? { rotate: [0, 3, -3, 0] } : {}}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${plan.iconBg} shadow-xl ${plan.shadow}`}
              >
                <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </motion.div>
              <div>
                <h3 className={`text-lg sm:text-xl font-black ${isComplete ? `bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent` : 'text-slate-900'}`}>
                  {plan.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {'segment' in plan ? String((plan as any).segment) : ''}
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
                    <span>{String(plan.subtitle)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Preço */}
            <div className="mb-4">
              <motion.div
                key={billingCycle}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-base text-slate-500 font-semibold">R$</span>
                  <span className={`text-4xl sm:text-5xl font-black ${plan.text}`}>
                    {formatPrice(currentPrice)}
                  </span>
                  <span className="text-slate-500 text-sm font-medium">
                    /{isAnnual ? 'ano' : 'mês'}
                  </span>
                </div>
                
                {isAnnual && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1"
                  >
                    <span className="text-xs text-emerald-600 font-semibold">
                      Equivale a R$ {formatPrice(pricing.annualMonthly)}/mês
                    </span>
                  </motion.div>
                )}
              </motion.div>
              
              {/* Trial Badge */}
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                className="mt-3"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full text-xs font-bold shadow-lg shadow-emerald-500/40">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>14 DIAS GRÁTIS</span>
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </motion.div>
              
              {/* ROI */}
              <p className="text-xs text-slate-500 mt-2 font-medium">
                1-2 diagnósticos por mês já cobrem a mensalidade.
              </p>
            </div>

            {/* Tagline */}
            <p className="text-sm text-slate-600 mb-4 font-medium leading-relaxed">
              {plan.tagline}
            </p>

            {/* Bloco Auto Elétrica */}
            {hasAutoEletrica && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-4 p-3 bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-bold text-amber-700">
                    {(plan as any).autoEletrica.title}
                  </span>
                </div>
                <ul className="space-y-1">
                  {(plan as any).autoEletrica.features.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-1.5 text-xs text-amber-700">
                      <CheckCircle2 className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* Features */}
            <ul className="space-y-2 mb-4">
              {plan.features.slice(0, 6).map((feature, idx) => {
                const featureText = typeof feature === 'string' ? feature : (feature as { text: string; highlight?: boolean }).text;
                const isHighlight = typeof feature === 'object' && feature !== null && (feature as { text: string; highlight?: boolean }).highlight;
                
                return (
                  <li key={idx} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.bg} shadow-sm`}>
                      <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={3} />
                    </div>
                    <span className={`text-sm text-slate-700 ${isHighlight ? "font-bold" : ""}`}>
                      {featureText}
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Disclaimer pré-fiscal */}
            <div className="flex items-start gap-2 mb-4 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                📄 Não emite nota. Organiza tudo para quem emite.
              </p>
            </div>

            {/* CTA Button */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={() => handlePlanSelect(planKey as any)}
                className={`cta-track w-full font-bold transition-all bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-xl shadow-emerald-500/30 ${
                  isComplete ? "h-14 text-base" : "h-12 text-sm"
                }`}
              >
                <span>Teste grátis por 14 dias</span>
                <ArrowRight className="ml-2 w-4 h-4 flex-shrink-0" />
              </Button>
            </motion.div>
            
            {/* Microcopy reduz medo */}
            <p className="text-[10px] text-slate-400 text-center mt-2">
              14 dias grátis · Sem cartão · Cancele quando quiser
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <section 
      ref={ref} 
      id="planos"
      className="py-16 sm:py-20 lg:py-24 bg-gradient-to-b from-white via-slate-50 to-white relative overflow-hidden"
    >
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#0077B6]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#FF7A18]/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-full mb-4"
          >
            <Target className="w-4 h-4 text-[#0077B6]" />
            <span className="text-xs sm:text-sm font-bold text-slate-700">NÍVEIS DE OPERAÇÃO</span>
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-3 leading-tight"
          >
            Em que nível está sua oficina?
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto"
          >
            Gestão não é custo. É o pré-requisito para crescer com controle.
          </motion.p>
        </div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          viewport={{ once: true }}
          className="flex justify-center mb-10"
        >
          <div className="bg-slate-100 p-1.5 rounded-full flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                billingCycle === 'monthly' 
                  ? 'bg-white text-slate-900 shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                billingCycle === 'annual' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Anual
              <Badge className="bg-orange-500 text-white text-[10px] px-2 py-0.5">
                -2 meses
              </Badge>
            </button>
          </div>
        </motion.div>

        {/* Savings message */}
        {isAnnual && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-700">
                Pague 10, use 12. Economia que se paga no primeiro mês.
              </span>
            </div>
          </motion.div>
        )}

        {/* Cards: moto_pro → carro_pro → oficina_completa */}
        <div 
          className="flex flex-col lg:flex-row gap-6 lg:gap-5 items-center lg:items-stretch justify-center pb-4 lg:pb-0"
          style={{ touchAction: 'pan-y' }}
        >
          {renderPlanCard("moto_pro", PLANS.moto_pro, 0)}
          {renderPlanCard("carro_pro", PLANS.carro_pro as any, 1)}
          {renderPlanCard("oficina_completa", PLANS.oficina_completa as any, 2)}
        </div>

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          viewport={{ once: true }}
          className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-slate-500"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>14 dias grátis</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Sem cartão para testar</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Cancele quando quiser</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
});

PricingSection.displayName = "PricingSection";

export default PricingSection;
