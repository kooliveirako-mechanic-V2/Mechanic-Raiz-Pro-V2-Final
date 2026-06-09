import { ArrowLeft, Lock, Eye, Database, Share2, UserCheck, ShieldCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function PoliticaPrivacidade() {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Eye,
      title: "1. Compromisso com a Privacidade",
      content: "A privacidade dos dados da sua oficina e de seus clientes é nossa prioridade absoluta. Esta política detalha como tratamos as informações no Mechanic Raiz Pro, em total conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018)."
    },
    {
      icon: Database,
      title: "2. Coleta de Dados",
      content: "Coletamos dados necessários para a operação: informações de cadastro (nome, e-mail, telefone), dados da oficina e informações dos veículos/clientes que você cadastra no sistema. Não coletamos dados sensíveis sem finalidade específica."
    },
    {
      icon: Lock,
      title: "3. Segurança e Armazenamento",
      content: "Utilizamos criptografia de ponta a ponta em trânsito (SSL/TLS) e armazenamento seguro em nuvem. Seus dados são protegidos por backups automáticos e monitoramento contínuo contra acessos não autorizados."
    },
    {
      icon: Share2,
      title: "4. Compartilhamento de Informações",
      content: "O Mechanic Raiz Pro NÃO vende, aluga ou comercializa seus dados com terceiros. O compartilhamento ocorre apenas com provedores de infraestrutura estritamente necessários (como hospedagem e gateways de pagamento) ou por obrigação legal."
    },
    {
      icon: UserCheck,
      title: "5. Seus Direitos (LGPD)",
      content: "Você tem o direito de acessar, corrigir, portar ou solicitar a exclusão de seus dados pessoais a qualquer momento. Para exercer esses direitos, basta entrar em contato com nosso Encarregado de Dados (DPO)."
    },
    {
      icon: ShieldCheck,
      title: "6. Uso de Cookies",
      content: "Utilizamos cookies funcionais para manter sua sessão ativa e melhorar a experiência de uso do sistema. Você pode configurar seu navegador para recusar cookies, mas isso poderá afetar algumas funcionalidades do Mechanic Raiz Pro."
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
            Política de Privacidade
          </motion.h1>
          <p className="text-slate-500 font-medium italic">
            Versão 2.0 - Última atualização: 08 de Junho de 2026
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
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <section.icon className="w-6 h-6 text-emerald-600" />
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
              className="pt-10 border-t border-slate-100 mt-12 text-center"
            >
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <Mail className="w-8 h-8 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">Canal de Privacidade</h3>
                <p className="text-slate-500 mb-4 max-w-md mx-auto">
                  Dúvidas sobre como tratamos seus dados ou solicitações de exclusão podem ser enviadas para:
                </p>
                <a href="mailto:suporte@mechanicraizpro.com.br" className="text-blue-600 hover:text-blue-700 font-bold text-lg underline decoration-2 underline-offset-4">
                  suporte@mechanicraizpro.com.br
                </a>
              </div>
            </motion.div>
          </div>
        </div>

        <footer className="mt-12 text-center text-slate-400 text-sm">
          <p>© 2026 Mechanic Raiz Pro - Em conformidade com a LGPD.</p>
        </footer>
      </div>
    </div>
  );
}
