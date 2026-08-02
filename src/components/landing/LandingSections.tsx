import { useRef } from "react";
import { useInView, motion } from "framer-motion";
import {
  Car,
  Bike,
  Zap,
  FileText,
  DollarSign,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Package,
  Users,
  BarChart3,
  MessageCircle,
  Wrench,
  HelpCircle,
  Sparkles,
  ClipboardList,
  Clock,
  ShieldCheck,
  ThumbsUp,
  Bell,
  Wifi,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StickyNavigation } from "./StickyNavigation";
import { SectionTracker } from "./SectionTracker";
import { PricingSection } from "./PricingSection";
import { RevenueLossSimulator } from "./RevenueLossSimulator";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { VideoDemoSection } from "./VideoDemoSection";
import { DashboardShowcaseCarousel } from "./DashboardShowcaseCarousel";
import { GuaranteeSection } from "./GuaranteeSection";
import { trackContactAndOpenWpp } from "@/lib/oracleWpp";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

function Section({ children, className = "", id }: SectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section
      ref={ref}
      id={id}
      className={`py-12 sm:py-16 md:py-24 transition-opacity duration-500 ${isInView ? "opacity-100" : "opacity-0"} ${className}`}
    >
      {children}
    </section>
  );
}

export function LandingSections({
  onScrollToTop,
  onScrollToSignup,
  onScrollToLogin,
}: {
  onScrollToTop: () => void;
  onScrollToSignup: () => void;
  onScrollToLogin: () => void;
}) {
  return (
    <div className="bg-white">
      <StickyNavigation
        onScrollToTop={onScrollToTop}
        onScrollToLogin={onScrollToLogin}
        onScrollToSignup={onScrollToSignup}
      />
      <SectionTracker />

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 2 — PARA QUEM É
          ═══════════════════════════════════════════════════════════ */}
      <Section className="bg-slate-50" id="para-quem">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                Feito para quem trabalha com as mãos{" "}
                <span className="text-[#0077B6]">e precisa de controle na palma da mão</span>
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
              {[
                {
                  icon: Car,
                  title: "Oficina mecânica de carro",
                  desc: "Controle OS, peças, financeiro e histórico de cada veículo. No celular, tablet ou computador.",
                  color: "bg-[#0077B6]",
                },
                {
                  icon: Bike,
                  title: "Oficina de moto",
                  desc: "Registro rápido de serviço, orçamento e controle de estoque pensado para motos.",
                  color: "bg-[#FF7A18]",
                },
                {
                  icon: Zap,
                  title: "Auto elétrica",
                  desc: "Diagnóstico com tempo e custo rastreados. Histórico elétrico salvo por veículo.",
                  color: "bg-amber-500",
                },
              ].map((item) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-center"
                >
                  <div
                    className={`w-14 h-14 ${item.color} rounded-xl flex items-center justify-center mx-auto mb-4`}
                  >
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 3 — O QUE RESOLVE NO DIA A DIA
          ═══════════════════════════════════════════════════════════ */}
      <Section className="bg-white" id="ordem-de-servico">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                O que o sistema resolve{" "}
                <span className="text-[#0077B6]">no seu dia a dia</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3 max-w-xl mx-auto">
                Cada item aqui resolve um problema real da rotina da oficina.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: FileText,
                  title: "Criar ordem de serviço rápido",
                  desc: "Abre a OS em minutos, com foto de entrada, peças e valor. Tudo registrado.",
                },
                {
                  icon: MessageCircle,
                  title: "Enviar orçamento pelo WhatsApp",
                  desc: "Cliente recebe o link, vê o preço e aprova. Sem vai-e-volta.",
                  id: "orcamento-whatsapp",
                },
                {
                  icon: DollarSign,
                  title: "Controlar financeiro",
                  desc: "Entradas, saídas e lucro real. Sem planilha. Pronto para o contador.",
                  id: "financeiro",
                },
                {
                  icon: Package,
                  title: "Controlar estoque",
                  desc: "Peça não some, custo não estoura. Sistema avisa quando tá acabando.",
                  id: "estoque",
                },
                {
                  icon: BarChart3,
                  title: "Saber o lucro real",
                  desc: "Veja quanto sobrou de verdade, por serviço e por mês. Sem achismo.",
                },
                {
                  icon: Users,
                  title: "Organizar cliente e veículo",
                  desc: "Histórico completo. Cliente volta e você já sabe tudo que foi feito.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  id={item.id}
                  className="flex items-start gap-4 p-5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#0077B6]/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#0077B6]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-[#0077B6]" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 3.5 — VEJA O PRODUTO REAL (demo + telas do app)
          ═══════════════════════════════════════════════════════════ */}
      <VideoDemoSection />
      <DashboardShowcaseCarousel />

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 4 — COMO FUNCIONA
          ═══════════════════════════════════════════════════════════ */}
      <Section className="bg-slate-50" id="como-funciona">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900">
                Simples assim.{" "}
                <span className="text-[#0077B6]">3 passos.</span>
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                Se sabe usar WhatsApp, sabe usar o Mechanic Raiz Pro.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 sm:gap-8 relative">
              {/* Connecting line (desktop) */}
              <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-[#0077B6] via-[#00A8E8] to-[#FF7A18]" />

              {[
                {
                  step: 1,
                  icon: Users,
                  title: "Cadastre cliente e veículo",
                  desc: "Nome, placa e pronto. Sem burocracia, leva menos de 1 minuto.",
                  color: "bg-[#0077B6]",
                },
                {
                  step: 2,
                  icon: ClipboardList,
                  title: "Crie a ordem de serviço",
                  desc: "Adicione peças, serviços e fotos. Tudo registrado e organizado.",
                  color: "bg-[#00A8E8]",
                },
                {
                  step: 3,
                  icon: BarChart3,
                  title: "Acompanhe tudo",
                  desc: "Orçamento, financeiro, estoque e andamento. Onde for melhor para sua rotina.",
                  color: "bg-[#FF7A18]",
                },
              ].map((item) => (
                <motion.div
                  key={item.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: item.step * 0.15 }}
                  className="relative text-center"
                >
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10`}
                  >
                    <item.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 bg-white rounded-full flex items-center justify-center text-xs font-bold text-[#0077B6] border-2 border-[#0077B6] z-20 shadow">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Button
                onClick={onScrollToSignup}
                size="lg"
                className="cta-track bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-xl shadow-emerald-500/30 px-8 py-6 text-sm md:text-base rounded-xl"
              >
                Teste grátis por 14 dias
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-xs text-slate-500 mt-3">
                Sem cartão de crédito · Cancela quando quiser
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 5 — BENEFÍCIOS REAIS
          ═══════════════════════════════════════════════════════════ */}
      <Section className="bg-white" id="beneficios">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900">
                O que muda na prática
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3">
                Resultado real, não conceito abstrato.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: FileText, text: "Menos papel, menos bagunça" },
                { icon: Clock, text: "Menos esquecimento de cobrança" },
                { icon: Smartphone, text: "Mais rapidez no atendimento" },
                { icon: DollarSign, text: "Mais clareza do que entrou e saiu" },
                { icon: ShieldCheck, text: "Mais segurança com registro e foto" },
                { icon: ThumbsUp, text: "Mais organização sem complicar" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="text-sm sm:text-base font-medium text-slate-800">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 5.4 — ANTES / DEPOIS (ponte visual benefícios → dor)
          ═══════════════════════════════════════════════════════════ */}
      <Section className="bg-white">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <BeforeAfterSlider />
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 5.5 — SIMULADOR DE PERDA (dor concreta antes do preço)
          ═══════════════════════════════════════════════════════════ */}
      <RevenueLossSimulator onScrollToSignup={onScrollToSignup} />

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 5.6 — GARANTIA (remove risco antes de ver o preço)
          ═══════════════════════════════════════════════════════════ */}
      <GuaranteeSection onScrollToSignup={onScrollToSignup} />

      {/* ═══════════════════════════════════════════════════════════
          SEÇÃO 6 — PLANOS E PREÇOS
          ═══════════════════════════════════════════════════════════ */}
      <PricingSection onScrollToSignup={onScrollToSignup} />

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 6 — FAQ COMERCIAL + SEO
          ═══════════════════════════════════════════════════════════ */}
      <Section className="bg-white" id="faq">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-full mb-4">
                <HelpCircle className="w-4 h-4 text-[#0077B6]" />
                <span className="text-xs sm:text-sm font-bold text-slate-700">PERGUNTAS FREQUENTES</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900">
                Dúvidas? A gente responde
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  q: "Funciona no celular?",
                  a: "Sim. Funciona no celular, no tablet e no computador. 100% online, acesse de qualquer lugar — no pátio, no balcão ou no escritório.",
                },
                {
                  q: "Tem teste grátis?",
                  a: "Sim. Você tem 14 dias grátis para testar tudo. Sem cartão de crédito e cancela quando quiser.",
                },
                {
                  q: "Serve para oficina de moto?",
                  a: "Sim. O sistema atende oficinas de moto com funcionalidades pensadas para esse segmento.",
                },
                {
                  q: "Serve para auto elétrica?",
                  a: "Sim. Tem espaço para registro de diagnóstico, módulos, sensores e histórico elétrico por veículo.",
                },
                {
                  q: "Dá para enviar orçamento pelo WhatsApp?",
                  a: "Sim. Você cria o orçamento no sistema e envia o link direto para o cliente pelo WhatsApp.",
                },
                {
                  q: "Tem ordem de serviço?",
                  a: "Sim. Cria OS completa com fotos, peças, valores e histórico. Tudo registrado e organizado.",
                },
                {
                  q: "Precisa instalar alguma coisa?",
                  a: "Não. O sistema funciona direto no navegador do celular ou computador. Sem instalação obrigatória.",
                },
                {
                  q: "É difícil de usar?",
                  a: "Não. Se você sabe usar WhatsApp, sabe usar o Mechanic Raiz Pro. Foi feito para mecânicos, não para TI.",
                },
              ].map((item) => (
                <div
                  key={item.q}
                  className="p-5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#0077B6]/30 transition-colors"
                >
                  <h3 className="text-base font-bold text-slate-900 mb-2">{item.q}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 6.5 — INSTALE NO CELULAR
          ═══════════════════════════════════════════════════════════ */}
      <Section className="bg-slate-50" id="instalar">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full mb-4">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                <span className="text-xs sm:text-sm font-bold text-emerald-700">USE NO CELULAR</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">
                Instale na tela inicial do seu celular
              </h2>
              <p className="text-sm sm:text-base text-slate-600 mt-3 max-w-xl mx-auto">
                Funciona como um aplicativo. Acesso rápido, notificações e offline. Sem baixar nada da loja.
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="flex flex-col items-center text-center p-5 rounded-xl bg-white border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Smartphone className="w-6 h-6 text-[#0077B6]" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1">Acesso rápido</h3>
                <p className="text-xs text-slate-500">Abra em 1 toque, sem digitar URL</p>
              </div>
              <div className="flex flex-col items-center text-center p-5 rounded-xl bg-white border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                  <Bell className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1">Notificações</h3>
                <p className="text-xs text-slate-500">Receba alertas de serviços e OS</p>
              </div>
              <div className="flex flex-col items-center text-center p-5 rounded-xl bg-white border border-slate-200">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                  <Wifi className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-1">Funciona offline</h3>
                <p className="text-xs text-slate-500">Consulte dados mesmo sem internet</p>
              </div>
            </div>

            <div className="text-center mt-8">
              <a
                href="/instalar"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0077B6] hover:bg-[#005F8A] text-white rounded-xl font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                Ver como instalar
              </a>
              <p className="text-xs text-slate-400 mt-2">
                Funciona no iPhone e Android · Sem precisar da App Store
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══════════════════════════════════════════════════════════
          BLOCO 7 — CTA FINAL
          ═══════════════════════════════════════════════════════════ */}
      <section
        className="py-14 sm:py-20 bg-gradient-to-br from-[#0077B6] via-[#005F8A] to-[#0E1B2A] text-white relative overflow-hidden"
        id="cta-final"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08)_0%,_transparent_60%)]" />

        <div className="container mx-auto px-4 sm:px-6 md:px-12 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-4">
              Comece a organizar sua oficina agora
            </h2>

            <p className="text-base sm:text-lg text-white/80 mb-6 max-w-xl mx-auto">
              Teste o Mechanic Raiz Pro por 14 dias grátis. Sem cartão, sem compromisso. No celular, tablet ou computador.
            </p>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20 mb-8">
              <Sparkles className="w-4 h-4 text-[#00A8E8]" />
              <span className="text-sm font-medium">Sem cartão · Sem compromisso · Cancele quando quiser</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={onScrollToSignup}
                size="lg"
                className="cta-track bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-xl shadow-emerald-500/40 py-7 px-10 text-base md:text-lg rounded-xl"
              >
                Teste grátis por 14 dias
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={() => {
                  trackContactAndOpenWpp("botao_topo");
                }}
                size="lg"
                className="bg-transparent border border-white/40 text-white hover:bg-white/10 font-bold py-7 px-8 text-base rounded-xl"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Falar no WhatsApp
              </Button>
            </div>

            <p className="text-xs text-white/50 mt-4">
              Sem cartão de crédito · Cancela quando quiser · Leva 2 minutos
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0E1B2A] py-10 border-t border-white/10">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="flex flex-col items-center gap-6">
            <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0077B6] to-[#00A8E8] flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold">Mechanic Raiz Pro</span>
              </div>

              <p className="text-slate-400 text-xs sm:text-sm text-center">
                © {new Date().getFullYear()} Mechanic Raiz Pro. Sistema de gestão para oficinas mecânicas.
              </p>

              <div className="flex items-center gap-4 text-slate-400 text-xs sm:text-sm">
                <span>Motos • Carros • Auto Elétrica</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
              <a
                href="/privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                Política de Privacidade
              </a>
              <span className="text-slate-700">·</span>
              <a
                href="/termos"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                Termos de Uso
              </a>
              <span className="text-slate-700">·</span>
              <span>📄 Sistema pré-fiscal. Não emite notas fiscais.</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-slate-400 text-xs sm:text-sm border-t border-white/10 pt-4 w-full justify-center">
              <span className="text-slate-500">Dúvidas?</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  trackContactAndOpenWpp("botao_rodape");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 rounded-full transition-all font-medium"
              >
                <Smartphone className="w-4 h-4" />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
