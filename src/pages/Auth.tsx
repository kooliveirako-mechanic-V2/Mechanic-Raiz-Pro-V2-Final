import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Wrench, Loader2, ChevronDown, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import heroImage from "@/assets/hero-mechanic-mobile.png";
import { LandingSections } from "@/components/landing/LandingSections";
import { FloatingWhatsApp } from "@/components/landing/FloatingWhatsApp";
import { LandingChatbot } from "@/components/landing/LandingChatbot";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordRecoveryModal } from "@/components/auth/PasswordRecoveryModal";
import { AuthFormTabs } from "@/components/auth/AuthFormTabs";
import { trackEvent, notifyMetaUrlChange } from "@/lib/tracking";
import { normalizeSource } from "@/lib/oracleWpp";

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [postResetMode, setPostResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const getDefaultTab = () => {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = params.has('utm_source') || params.has('utm_medium') || params.has('utm_campaign') || params.has('gclid') || params.has('fbclid');
    const isReturning = localStorage.getItem('mechpro_visited');
    if (hasUtm || !isReturning) return "register";
    return "login";
  };
  const [activeTab, setActiveTab] = useState(getDefaultTab);
  const heroRef = useRef<HTMLDivElement>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  // Password recovery (request email)
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Blindagem: ao abrir /auth limpar campo de senha (evita autofill stale)
  useEffect(() => {
    setLoginPassword("");
  }, []);

  // Detect legacy recovery links and forward to dedicated /reset-password page
  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);
    const type = hashParams.get("type") || queryParams.get("type");
    const hasToken =
      hashParams.get("access_token") ||
      queryParams.get("access_token") ||
      queryParams.get("code");
    const errorCode = hashParams.get("error_code") || queryParams.get("error_code");

    if (type === "recovery" && hasToken) {
      // Forward original hash/query so /reset-password can consume tokens
      const search = window.location.search;
      const hashFwd = window.location.hash;
      navigate(`/reset-password${search}${hashFwd}`, { replace: true });
      return;
    }

    if (errorCode && type === "recovery") {
      navigate(`/reset-password${window.location.search}${window.location.hash}`, {
        replace: true,
      });
    }
  }, [navigate]);

  // Redirect if already logged in (auto-redirect to invite page if present)
  useEffect(() => {
    if (!authLoading && user) {
      const params = new URLSearchParams(window.location.search);
      const inviteToken = params.get("invite") || sessionStorage.getItem("pending_invite_token");
      if (inviteToken) {
        navigate(`/convite/${inviteToken}`, { replace: true });
        return;
      }
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("reset") !== "success") return;

    const resetEmail = sessionStorage.getItem("mrp_reset_email");

    setActiveTab("login");
    setShowForgotPassword(false);
    setPostResetMode(true);
    setLoginPassword("");

    if (resetEmail) {
      setLoginEmail(resetEmail);
      sessionStorage.removeItem("mrp_reset_email");
    }

    toast.info("Senha alterada", {
      description:
        "Digite manualmente a NOVA senha. Seu navegador pode preencher a senha antiga automaticamente.",
      duration: 10000,
    });

    window.history.replaceState({}, document.title, "/auth");
  }, []);

  // Capture UTM params on mount
  const [utmParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(key => {
      const val = params.get(key);
      if (val) utm[key] = val;
    });
    // Fallback: hidrata a partir do localStorage (UTM persistido em index.html)
    if (Object.keys(utm).length === 0) {
      try {
        const stored = JSON.parse(localStorage.getItem('mrp_utms') || '{}');
        Object.keys(stored).forEach(k => {
          if (k !== '_ts' && stored[k]) utm[k] = stored[k];
        });
      } catch {}
    }
    // utm_slug: SEMPRE anexa quando disponível (independe de outras UTMs).
    // Vem do shortlink ?mo=CODE → persistido pelo script em index.html.
    try {
      const slugSrc =
        new URLSearchParams(window.location.search).get('mo') ||
        (JSON.parse(localStorage.getItem('mrp_utms') || '{}') as any)?.utm_slug ||
        '';
      const s = String(slugSrc).trim().toLowerCase();
      if (/^[a-z0-9]{3,32}$/.test(s)) utm.utm_slug = s;
    } catch {}
    const ref = document.referrer;
    if (ref) utm['referrer'] = ref;
    return utm;
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    if (error) {
      const msg = error.message || "";
      if (msg.includes("Email not confirmed")) {
        toast.error("Confirme seu e-mail", {
          description:
            "Verifique sua caixa de entrada e clique no link de confirmação para entrar.",
        });
      } else if (msg.includes("Invalid login credentials")) {
        toast.error("E-mail ou senha incorretos", {
          description:
            "Se você já usava o sistema antigo, recupere a senha ou entre com Google usando o mesmo e-mail.",
          duration: 9000,
          action: {
            label: "Recuperar senha",
            onClick: () => setShowForgotPassword(true),
          },
        });
      } else if (msg.includes("Too many requests") || msg.toLowerCase().includes("rate limit")) {
        toast.error("Muitas tentativas", {
          description: "Aguarde alguns minutos antes de tentar novamente.",
        });
      } else {
        toast.error("Erro ao entrar", {
          description: msg || "Tente novamente em instantes.",
        });
      }
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/");
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    setLoading(true);

    // Dispara Lead ANTES do signup — se Supabase rejeitar (422), o lead ainda foi medido
    try {
      const emailNorm = registerEmail?.trim().toLowerCase();
      const nameParts = (registerName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || undefined;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
      // Normaliza telefone: remove não-dígitos, adiciona DDI 55 se começar com 9 ou dígito
      let phoneNorm = (registerPhone || '').replace(/\D/g, '');
      if (phoneNorm.length > 0 && !phoneNorm.startsWith('55')) {
        phoneNorm = '55' + phoneNorm;
      }
      const leadPayload: Record<string, any> = {
        email: emailNorm,
        phone: phoneNorm || undefined,
        external_id: emailNorm,
        first_name: firstName,
        last_name: lastName,
        value: 0,
        currency: 'BRL',
        content_name: 'Lead Mechanic RaizPro',
      };
      // Anexa UTMs capturadas + normaliza utm_source (Meta_Ads → meta_ads etc).
      // A normalização precisa acontecer ANTES do POST pra ficar consistente entre
      // crm_leads.utm_source (signup metadata) e capi_events.utm_source (MOCapi).
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_slug'].forEach(k => {
        if (utmParams[k]) leadPayload[k] = utmParams[k];
      });
      if (leadPayload.utm_source) {
        leadPayload.utm_source = normalizeSource(leadPayload.utm_source);
      }
      // Fase 1b: trackEvent('lead_created') = dataLayer + Pixel(Lead) + MOCapi(Lead),
      // tudo com mesmo event_id (Meta dedupa Pixel × CAPI).
      // [Fase F] Dedup: 1 Lead POR SESSÃO (evita re-disparo se o usuário voltar e re-submeter).
      trackEvent('lead_created', { params: leadPayload, dedupKey: 'lead_created', dedupTtlMs: Number.POSITIVE_INFINITY });
    } catch (e) { console.warn('[Auth] Lead tracking failed', e); }

    // Normaliza utm_source antes de enviar pra signup metadata (crm_leads.utm_source consistente com capi_events)
    const utmParamsNorm: Record<string, string> = { ...utmParams };
    if (utmParamsNorm.utm_source) utmParamsNorm.utm_source = normalizeSource(utmParamsNorm.utm_source);

    const { error, session } = await signUp(
      registerEmail,
      registerPassword,
      registerName,
      Object.keys(utmParamsNorm).length > 0 || registerPhone
        ? { ...utmParamsNorm, ...(registerPhone ? { telefone: registerPhone } : {}) }
        : undefined
    );
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
    } else {
      localStorage.setItem('mechpro_visited', 'true');
      // Fase 1b: signup_completed via trackEvent (dataLayer + Pixel(CompleteRegistration) + MOCapi).
      // GTM consome dataLayer e dispara GA4 sign_up + Google Ads conversion.
      trackEvent('signup_completed', {
        params: { method: 'email' },
        dedupKey: 'signup_completed:session',
        dedupTtlMs: Infinity,
      });
      if (session) {
        // Conta criada com sessão ativa — vai para a página de sucesso,
        // que redireciona para "/" após 3s. Mantém URL única p/ Meta Event Setup Tool.
        toast.success("Conta criada! Bem-vindo ao Mechanic Raiz Pro.");
        navigate("/cadastro-concluido");
      } else {
        // Conta criada sem sessão — confirmação de e-mail ainda exigida.
        // Mesmo assim, navegamos para /cadastro-concluido para disparar
        // CompleteRegistration no Meta (a página mostra instrução de confirmar e-mail).
        toast.success("Conta criada!", {
          description:
            "Verifique seu e-mail e clique no link de confirmação para entrar.",
          duration: 9000,
        });
        navigate("/cadastro-concluido");
      }
    }
    setLoading(false);
  };

  const scrollToTop = () => heroRef.current?.scrollIntoView({ behavior: "smooth" });
  // CTAs genéricos (hero/nav/footer/CTA final) marcam ?intencao=teste_gratis para rastrear "Lead" no Meta/GA4.
  // Botões da seção de Planos usam ?plano=moto|carro|oficina via PricingSection (StartTrial).
  const markGenericTrialIntent = () => {
    try {
      const url = new URL(window.location.href);
      // não marca intenção genérica se já existe plano específico selecionado nesta visita
      if (url.searchParams.get('plano')) return;
      if (url.searchParams.get('intencao') === 'teste_gratis') {
        // já marcado — apenas garante o evento dedicado (dedup interno protege)
        trackEvent('trial_intent_generic', {
          params: { intent: 'teste_gratis', source: 'generic_cta' },
          dedupKey: 'trial_intent_generic:session',
          dedupTtlMs: Infinity,
        });
        return;
      }
      url.searchParams.set('intencao', 'teste_gratis');
      window.history.pushState({ intencao: 'teste_gratis' }, '', url.toString());
      // [GTM] evento dedicado p/ generate_lead — dispara 1x por sessão, sem depender de page_view+URL contains.
      trackEvent('trial_intent_generic', {
        params: { intent: 'teste_gratis', source: 'generic_cta' },
        dedupKey: 'trial_intent_generic:session',
        dedupTtlMs: Infinity,
      });
      // [Fase H5] avisa Pixel da nova URL → Event Setup Tool reavalia "URL contains intencao=teste_gratis"
      notifyMetaUrlChange();
    } catch {}
  };
  const scrollToSignup = () => { markGenericTrialIntent(); setActiveTab("register"); heroRef.current?.scrollIntoView({ behavior: "smooth" }); };
  const scrollToLogin = () => { setActiveTab("login"); heroRef.current?.scrollIntoView({ behavior: "smooth" }); };

  // Shared form props
  const formProps = {
    activeTab,
    onTabChange: setActiveTab,
    loginEmail,
    onLoginEmailChange: setLoginEmail,
    loginPassword,
    onLoginPasswordChange: setLoginPassword,
    onLoginSubmit: handleLogin,
    registerName,
    onRegisterNameChange: setRegisterName,
    registerEmail,
    onRegisterEmailChange: setRegisterEmail,
    registerPhone,
    onRegisterPhoneChange: setRegisterPhone,
    registerPassword,
    onRegisterPasswordChange: setRegisterPassword,
    onRegisterSubmit: handleRegister,
    loading,
    postResetMode,
    showPassword,
    onTogglePassword: () => setShowPassword(!showPassword),
    onForgotPassword: () => setShowForgotPassword(true),
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0E1B2A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF7A00]" />
          <p className="text-white/70">Carregando...</p>
        </div>
      </div>
    );
  }

  // Brand + Headline block (reused across layouts)
  const BrandBlock = ({ size = "lg" }: { size?: "sm" | "md" | "lg" }) => {
    const iconSize = size === "sm" ? "w-16 h-16" : size === "md" ? "w-12 h-12" : "w-20 h-20";
    const iconInner = size === "sm" ? "w-8 h-8" : size === "md" ? "w-6 h-6" : "w-10 h-10";
    const titleSize = size === "sm" ? "text-2xl" : size === "md" ? "text-xl" : "text-3xl";
    const headlineSize = size === "sm" ? "text-lg" : size === "md" ? "text-base" : "text-xl";
    const descSize = size === "sm" ? "text-xs" : size === "md" ? "text-xs" : "text-sm";
    const isCompact = size === "md";

    return (
      <>
        <div className={`flex ${isCompact ? "items-center justify-center gap-3" : "flex-col items-center"} ${isCompact ? "mb-4" : "mb-6"}`}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={`${iconSize} ${isCompact ? "" : "mb-3 md:mb-4"} rounded-${isCompact ? "xl" : "2xl"} bg-gradient-to-br from-[#0077B6] via-[#005F8A] to-[#003D5C] shadow-xl shadow-[#0077B6]/40 border border-[#00A8E8]/30 flex items-center justify-center ${isCompact ? "flex-shrink-0" : ""}`}
          >
            <Wrench className={`${iconInner} text-white drop-shadow-lg`} />
          </motion.div>
          <h1 className={`${titleSize} font-bold`}>
            <span className="text-[#003D5C]">Mechanic{!isCompact && " "}</span>
            <span className="text-[#0077B6]">Raiz{!isCompact && " "}</span>
            <span className="bg-gradient-to-r from-[#0077B6] to-[#00A8E8] bg-clip-text text-transparent">Pro</span>
          </h1>
        </div>

        <div className="text-center mb-4">
          <h2 className={`${headlineSize} font-bold text-[#0E1B2A] leading-snug mb-2${!isCompact ? " md:mb-3" : ""}`}>
            Sistema de Gestão Profissional
            <br />
            <span className="text-[#0077B6]">para oficinas que querem crescer</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-2 mb-2 md:mb-3">
            <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded-full">📱 Celular</span>
            <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded-full">📟 Tablet</span>
            <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded-full">💻 Computador</span>
          </div>
          <p className={`text-[#0E1B2A]/80 ${descSize} leading-relaxed`}>
            Controle total de clientes, OS, financeiro e estoque.
            <br />
            <strong>Quem usa opera em outro nível.</strong>
          </p>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Password Recovery (request email) */}
      <PasswordRecoveryModal
        visible={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={loginEmail}
      />

      {/* ═══ HERO INICIAL — Headline de dor + CTA ═══ */}
      <section className="bg-[#0E1B2A] text-white py-16 sm:py-24 md:py-32 relative overflow-hidden" id="hero">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(0,119,182,0.15),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(255,122,24,0.08),_transparent_50%)]" />

        <div className="container mx-auto px-4 sm:px-6 md:px-12 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6"
            >
              Sistema para oficina mecânica{" "}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-[#00A8E8] to-[#0077B6] bg-clip-text text-transparent">
                simples, rápido e fácil de usar
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-4"
            >
              Crie ordem de serviço em minutos, envie orçamento pelo WhatsApp e acompanhe financeiro, estoque e lucro da oficina.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="text-sm sm:text-base text-slate-400 mb-8"
            >
              Use no celular no pátio, no tablet no balcão ou no computador no escritório.
            </motion.p>

            {/* Segmentos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-3 mb-8"
            >
              {[
                { emoji: "🏍️", label: "Oficinas de Moto", color: "from-orange-500/20 to-orange-600/10", border: "border-orange-400/30" },
                { emoji: "🚗", label: "Oficinas de Carro", color: "from-blue-500/20 to-blue-600/10", border: "border-blue-400/30" },
                { emoji: "⚡", label: "Auto Elétrica", color: "from-amber-500/20 to-yellow-600/10", border: "border-amber-400/30" }
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.35 + i * 0.1 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className={`flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r ${item.color} rounded-2xl border ${item.border} backdrop-blur-md shadow-lg cursor-default`}
                >
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-sm font-bold text-white tracking-wide">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-col items-center gap-3"
            >
              <Button
                onClick={scrollToSignup}
                size="lg"
                className="cta-track bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-xl shadow-emerald-500/40 px-8 py-7 text-base md:text-lg rounded-xl"
              >
                Teste grátis por 14 dias
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <p className="text-xs text-slate-500 mt-2">
                Sem cartão de crédito · Cancela quando quiser · Leva 2 minutos
              </p>
              <button
                onClick={scrollToLogin}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors underline underline-offset-2 mt-1"
              >
                Já tenho conta — entrar
              </button>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-white/50 cursor-pointer"
          onClick={scrollToSignup}
        >
          <span className="text-xs font-medium">Criar conta grátis</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* Hero Section - Form / Login */}
      <div ref={heroRef} className="min-h-screen min-h-[100dvh] flex flex-col md:flex-row relative overflow-x-hidden bg-[#0E1B2A]">
        {/* ═══ MOBILE ═══ */}
        <div className="md:hidden flex flex-col min-h-[100dvh] bg-white">
          <div className="flex-1 flex items-start justify-center px-5 py-8 overflow-y-auto">
            <div className="w-full max-w-sm">
              <BrandBlock size="sm" />
              <AuthFormTabs {...formProps} variant="mobile" />
            </div>
          </div>
        </div>

        {/* ═══ TABLET ═══ */}
        <div className="hidden md:flex lg:hidden w-full min-h-screen">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="w-[45%] relative overflow-hidden flex-shrink-0"
          >
            <img
              src={heroImage}
              alt="Mecânico brasileiro profissional usando o sistema Mechanic Raiz Pro no celular"
              className="absolute inset-0 w-full h-full object-cover object-[center_15%] scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E1B2A]/20 via-transparent to-[#0E1B2A]/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E1B2A]/40 via-transparent to-transparent" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-[55%] flex flex-col bg-white overflow-y-auto max-h-screen"
          >
            <div className="flex-1 flex items-start justify-center p-5 py-6">
              <div className="w-full max-w-sm">
                <BrandBlock size="md" />
                <AuthFormTabs {...formProps} variant="tablet" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══ DESKTOP ═══ */}
        <div className="hidden lg:flex w-full min-h-screen">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="w-[60%] xl:w-[65%] relative overflow-hidden"
          >
            <img
              src={heroImage}
              alt="Mecânico brasileiro profissional usando o sistema Mechanic Raiz Pro no celular"
              className="absolute inset-0 w-full h-full object-cover object-[center_15%] scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0E1B2A]/20 via-transparent to-[#0E1B2A]/80" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E1B2A]/40 via-transparent to-transparent" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="w-[40%] xl:w-[35%] flex items-center justify-center p-6 xl:p-10 bg-white"
          >
            <div className="w-full max-w-md">
              <BrandBlock size="lg" />
              <AuthFormTabs {...formProps} variant="desktop" />
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-[#1a3a52] cursor-pointer z-10"
          onClick={() => window.scrollTo({ top: window.innerHeight, behavior: "smooth" })}
        >
          <span className="text-sm font-semibold">Saiba mais</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronDown className="w-6 h-6" />
          </motion.div>
        </motion.div>
      </div>

      {/* Landing Page Sections */}
      <LandingSections onScrollToTop={scrollToTop} onScrollToSignup={scrollToSignup} onScrollToLogin={scrollToLogin} />

      {/* Floating WhatsApp Button */}
      <FloatingWhatsApp />

      {/* AI Chatbot */}
      <LandingChatbot />
    </div>
  );
}
