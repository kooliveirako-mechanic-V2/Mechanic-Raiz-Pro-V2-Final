import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PoliticaPrivacidade() {
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

        <h1 className="text-3xl font-bold text-foreground mb-8">Política de Privacidade</h1>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            Última atualização: Janeiro de 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">1. Introdução</h2>
            <p className="text-muted-foreground">
              A sua privacidade é importante para nós. Esta Política de Privacidade explica como o Mechanic Raiz Pro 
              coleta, usa, armazena e protege suas informações pessoais.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">2. Dados que Coletamos</h2>
            <p className="text-muted-foreground">
              Coletamos os seguintes tipos de informações:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, e-mail, telefone, endereço da oficina</li>
              <li><strong>Dados operacionais:</strong> clientes, veículos, ordens de serviço, orçamentos</li>
              <li><strong>Dados financeiros:</strong> movimentações, contas a pagar/receber (não processamos pagamentos diretamente)</li>
              <li><strong>Dados de uso:</strong> logs de acesso, funcionalidades utilizadas, preferências</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">3. Como Usamos seus Dados</h2>
            <p className="text-muted-foreground">
              Utilizamos suas informações para:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Fornecer e manter o serviço funcionando</li>
              <li>Personalizar sua experiência no sistema</li>
              <li>Enviar comunicações importantes sobre o serviço</li>
              <li>Melhorar nossos produtos e funcionalidades</li>
              <li>Fornecer suporte técnico</li>
              <li>Cumprir obrigações legais</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">4. Armazenamento e Segurança</h2>
            <p className="text-muted-foreground">
              Seus dados são armazenados em servidores seguros com criptografia. Implementamos medidas 
              técnicas e organizacionais para proteger suas informações contra acesso não autorizado, 
              alteração, divulgação ou destruição.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Criptografia de dados em trânsito (HTTPS)</li>
              <li>Criptografia de dados em repouso</li>
              <li>Controle de acesso baseado em funções</li>
              <li>Backups regulares</li>
              <li>Monitoramento de segurança 24/7</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">5. Compartilhamento de Dados</h2>
            <p className="text-muted-foreground">
              <strong>Não vendemos seus dados.</strong> Podemos compartilhar informações apenas:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Com provedores de serviço que nos ajudam a operar o sistema (hospedagem, e-mail)</li>
              <li>Quando exigido por lei ou ordem judicial</li>
              <li>Para proteger nossos direitos ou segurança</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">6. Seus Direitos (LGPD)</h2>
            <p className="text-muted-foreground">
              De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Acesso:</strong> solicitar uma cópia dos seus dados</li>
              <li><strong>Correção:</strong> corrigir dados incompletos ou incorretos</li>
              <li><strong>Exclusão:</strong> solicitar a exclusão dos seus dados</li>
              <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado</li>
              <li><strong>Revogação:</strong> revogar o consentimento a qualquer momento</li>
            </ul>
            <p className="text-muted-foreground">
              Para exercer qualquer desses direitos, entre em contato conosco pelo e-mail: 
              suporte@mechanicraizpro.com.br
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">7. Cookies e Tecnologias Similares</h2>
            <p className="text-muted-foreground">
              Utilizamos cookies e tecnologias similares para manter você logado, lembrar suas preferências 
              e melhorar sua experiência. Você pode configurar seu navegador para recusar cookies, mas 
              algumas funcionalidades podem não funcionar corretamente.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">8. Retenção de Dados</h2>
            <p className="text-muted-foreground">
              Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário para fornecer 
              nossos serviços. Após o encerramento da conta, os dados são retidos por até 5 anos para 
              fins legais e depois são excluídos permanentemente.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">9. Alterações nesta Política</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre alterações 
              significativas por e-mail ou aviso no sistema. Recomendamos revisar esta página regularmente.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-foreground">10. Contato</h2>
            <p className="text-muted-foreground">
              Para dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados:
            </p>
            <ul className="list-none pl-0 text-muted-foreground space-y-2">
              <li>📧 E-mail: suporte@mechanicraizpro.com.br</li>
              <li>📱 WhatsApp: (11) 95089-1497</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
