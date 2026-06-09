import { ArrowLeft, Shield, Scale, FileText, Lock, AlertCircle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function TermosUso() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Shield,
      title: "1. Aceitação dos Termos",
      content: "Ao acessar e utilizar o Mechanic Raiz Pro, você concorda legalmente com estes Termos de Uso. Este é um contrato entre você (ou sua oficina) e o Mechanic Raiz Pro. Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços."
    },
    {
      icon: FileText,
      title: "2. Descrição do Serviço",
      content: "O Mechanic Raiz Pro é uma plataforma SaaS (Software as a Service) de gestão operacional e pré-fiscal para oficinas mecânicas. O sistema oferece ferramentas de gestão de OS, controle de estoque, orçamentos e organização financeira. IMPORTANTE: O sistema NÃO é um emissor de notas fiscais e não substitui obrigações tributárias legais."
    },
    {
      icon: Lock,
      title: "3. Cadastro e Segurança",
      content: "Para utilizar o sistema, é necessário um cadastro válido. Você é o único responsável por manter a confidencialidade de sua senha e por todas as atividades que ocorrem em sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado."
    },
    {
      icon: Scale,
      title: "4. Propriedade Intelectual",
      content: "Todo o conteúdo do sistema, incluindo marcas, logotipos, textos, gráficos, imagens, software e código-fonte, é de propriedade exclusiva do Mechanic Raiz Pro ou de seus licenciadores, protegidos pelas leis de propriedade intelectual brasileiras e internacionais."
    },
    {
      icon: AlertCircle,
      title: "5. Limitação de Responsabilidade",
      content: "O Mechanic Raiz Pro não se responsabiliza por perdas de lucros, danos indiretos ou decisões comerciais baseadas em dados inseridos incorretamente pelo usuário. O sistema é fornecido 'como está' e não garantimos que será 100% livre de erros ou interrupções temporárias."
    },
    {
      icon: HelpCircle,
      title: "6. Cancelamento e Reembolso",
      content: "Você pode cancelar sua assinatura a qualquer momento através do painel de configurações. O acesso continuará ativo até o final do período já pago. Reembolsos são analisados individualmente conforme o Código de Defesa do Consumidor."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para o Início
          </Button>
        </motion.div>

        <header className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-slate-900 mb-4"
          >
            Termos de Uso
          </motion.h1>
          <p className="text-slate-500 font-medium italic">
            Última atualização: 08 de Junho de 2026
          </p>
        </header>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-8 md:p-12 space-y-12">
            {sections.map((section, index) => (
              <motion.section 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <section.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800">{section.title}</h2>
                </div>
                <p className="text-slate-600 leading-relaxed text-lg">
                  {section.content}
                </p>
              </motion.section>
            ))}

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="pt-8 border-t border-slate-100 mt-12"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-4 text-center">Dúvidas sobre os Termos?</h3>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
                <a href="mailto:suporte@mechanicraizpro.com.br" className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2">
                  📧 suporte@mechanicraizpro.com.br
                </a>
                <a href="https://wa.me/5511950891497" target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-2">
                  📱 WhatsApp Suporte
                </a>
              </div>
            </motion.div>
          </div>
        </div>

        <footer className="mt-12 text-center text-slate-400 text-sm">
          <p>© 2026 Mechanic Raiz Pro - Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
