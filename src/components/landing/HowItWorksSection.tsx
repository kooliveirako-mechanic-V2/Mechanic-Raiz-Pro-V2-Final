import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { UserPlus, FileText, TrendingUp, Bell, Frown, Smile } from "lucide-react";

const beforeItems = [
  "Caderno, papel, WhatsApp perdido — tudo espalhado",
  "Cliente cobra e você precisa correr pra lembrar",
  "Fim do mês: \"acho que deu lucro\". Acho não paga conta."
];

const afterItems = [
  "Tudo no celular, organizado, na palma da mão",
  "Cliente pergunta? Mostra o registro na hora",
  "Lucro real por serviço — calculado, não chutado"
];

const steps = [
  {
    icon: UserPlus,
    title: "Cadastra rápido",
    description: "Cliente chegou? Nome, veículo, pronto. Sem burocracia.",
    color: "bg-[#0077B6]",
    highlight: "🎁 14 dias grátis"
  },
  {
    icon: FileText,
    title: "Registra o serviço",
    description: "Abre a OS, tira foto de entrada, adiciona peças. Tudo registrado.",
    color: "bg-[#00A8E8]"
  },
  {
    icon: Bell,
    title: "Cliente avisado",
    description: "Pronto? O cliente recebe aviso. Profissional, sem ligar correndo.",
    color: "bg-emerald-500"
  },
  {
    icon: TrendingUp,
    title: "Sabe o resultado",
    description: "Lucro por serviço, estoque atualizado, financeiro organizado. Sem achismo.",
    color: "bg-[#FF7A18]"
  }
];

export function HowItWorksSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section 
      ref={ref}
      className="py-16 sm:py-20 md:py-28 bg-white overflow-hidden"
      id="como-funciona"
    >
      <div className="container mx-auto px-4 sm:px-6 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16"
        >
          <span className="inline-block text-xs sm:text-sm font-bold text-[#0077B6] mb-3 tracking-wide uppercase">
            Simples assim
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[#0E1B2A] mb-4">
            Simples assim.{" "}
            <span className="bg-gradient-to-r from-[#0077B6] to-[#00A8E8] bg-clip-text text-transparent">
              4 passos.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto">
            Se sabe usar WhatsApp, sabe usar o Mechanic Raiz Pro.
          </p>
        </motion.div>

        {/* Before / After mini-block */}
        <div className="max-w-3xl mx-auto mb-12 sm:mb-16 grid sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-5 rounded-xl bg-red-50 border border-red-200"
          >
            <div className="flex items-center gap-2 mb-3">
              <Frown className="w-5 h-5 text-red-500" />
              <span className="text-sm font-bold text-red-600">Sem organizar nada</span>
            </div>
            <ul className="space-y-2">
              {beforeItems.map(item => (
                <li key={item} className="text-sm text-red-700 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-5 rounded-xl bg-emerald-50 border border-emerald-200"
          >
            <div className="flex items-center gap-2 mb-3">
              <Smile className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-bold text-emerald-600">Com o Mechanic Raiz Pro</span>
            </div>
            <ul className="space-y-2">
              {afterItems.map(item => (
                <li key={item} className="text-sm text-emerald-700 flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Steps with connecting line */}
        <div className="max-w-5xl mx-auto relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-[#0077B6] via-[#00A8E8] via-emerald-500 to-[#FF7A18] rounded-full" />
          
          {/* Animated line progress */}
          <motion.div
            className="hidden md:block absolute top-24 left-0 h-1 bg-gradient-to-r from-[#0077B6] to-[#FF7A18] rounded-full"
            initial={{ width: "0%" }}
            animate={isInView ? { width: "100%" } : { width: "0%" }}
            transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
          />

          <div className="grid md:grid-cols-4 gap-6 sm:gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{ 
                  duration: 0.6, 
                  delay: 0.3 + index * 0.2,
                  ease: [0.25, 0.46, 0.45, 0.94]
                }}
                className="relative text-center"
              >
                {/* Step number */}
                <motion.div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold text-[#0077B6] border-2 border-[#0077B6] z-10 shadow-lg"
                  animate={isInView ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.5, delay: 0.8 + index * 0.2 }}
                >
                  {index + 1}
                </motion.div>

                {/* Icon container */}
                <div className={`w-16 h-16 sm:w-20 sm:h-20 ${step.color} rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl`}>
                  <step.icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>

                {/* Content */}
                <h3 className="font-bold text-[#0E1B2A] text-base sm:text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-sm sm:text-base text-[#1a3a52] leading-relaxed">
                  {step.description}
                </p>
                {step.highlight && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
                    transition={{ delay: 1.5, type: "spring" }}
                    className="inline-block mt-2 px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold rounded-full"
                  >
                    {step.highlight}
                  </motion.span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
