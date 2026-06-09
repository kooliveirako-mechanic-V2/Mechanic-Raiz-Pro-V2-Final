import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function TermosUso() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Termos de Uso</h1>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Última atualização: Janeiro de 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Aceitação dos Termos</h2>
            <p className="text-muted-foreground">
              Ao acessar e utilizar o Mechanic Raiz Pro, você concorda com estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Descrição do Serviço</h2>
            <p className="text-muted-foreground">
              O Mechanic Raiz Pro é um sistema de gestão operacional e pré-fiscal para oficinas mecânicas, 
              auto elétricas e centros automotivos. O sistema oferece funcionalidades como:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Gestão de ordens de serviço</li>
              <li>Controle de clientes e veículos</li>
              <li>Gestão financeira básica</li>
              <li>Controle de estoque</li>
              <li>Orçamentos e propostas</li>
              <li>Agenda e agendamentos</li>
            </ul>
            <p className="text-muted-foreground font-medium">
              Importante: O Mechanic Raiz Pro NÃO emite notas fiscais. É um sistema de gestão operacional 
              e pré-fiscal para organização interna da oficina.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. Cadastro e Conta</h2>
            <p className="text-muted-foreground">
              Para utilizar o sistema, você deve criar uma conta fornecendo informações verdadeiras e completas. 
              Você é responsável por manter a confidencialidade de suas credenciais de acesso.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Uso Aceitável</h2>
            <p className="text-muted-foreground">
              Você concorda em utilizar o Mechanic Raiz Pro apenas para fins legais e de acordo com estes termos. 
              É proibido:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Compartilhar credenciais de acesso com terceiros não autorizados</li>
              <li>Tentar acessar áreas restritas do sistema</li>
              <li>Utilizar o sistema para atividades ilegais</li>
              <li>Fazer engenharia reversa ou copiar o código-fonte</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Planos e Pagamentos</h2>
            <p className="text-muted-foreground">
              O Mechanic Raiz Pro oferece diferentes planos de assinatura. Os valores e condições são apresentados 
              na página de planos. O pagamento é processado de forma segura através de parceiros homologados.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Propriedade Intelectual</h2>
            <p className="text-muted-foreground">
              Todo o conteúdo, design, código e funcionalidades do Mechanic Raiz Pro são de propriedade exclusiva 
              da empresa desenvolvedora e estão protegidos por leis de propriedade intelectual.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Limitação de Responsabilidade</h2>
            <p className="text-muted-foreground">
              O Mechanic Raiz Pro é fornecido "como está". Não nos responsabilizamos por:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Interrupções temporárias no serviço</li>
              <li>Perda de dados devido a mau uso</li>
              <li>Decisões comerciais baseadas nas informações do sistema</li>
              <li>Erros de cálculo por dados incorretos inseridos pelo usuário</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. Alterações nos Termos</h2>
            <p className="text-muted-foreground">
              Reservamo-nos o direito de modificar estes termos a qualquer momento. 
              Alterações significativas serão comunicadas por e-mail ou notificação no sistema.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre estes Termos de Uso, entre em contato através do WhatsApp: 
              (11) 95089-1497 ou e-mail: suporte@mechanicraizpro.com.br
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
