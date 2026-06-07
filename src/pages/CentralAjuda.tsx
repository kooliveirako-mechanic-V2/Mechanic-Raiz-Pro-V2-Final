import { ArrowLeft, Search, BookOpen, Wrench, FileText, DollarSign, Users, Car, Package, Calendar, Shield, Zap, Smartphone, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const helpCategories = [
  {
    id: "inicio",
    icon: BookOpen,
    title: "Primeiros Passos",
    color: "text-primary",
    bgColor: "bg-primary/10",
    items: [
      {
        question: "Como criar minha primeira Ordem de Serviço?",
        answer: "Acesse o menu 'Serviços', clique em 'Nova OS', selecione ou cadastre o cliente, selecione o veículo, preencha o tipo de serviço e valor. A OS será salva automaticamente como 'Aguardando'."
      },
      {
        question: "Como cadastrar um cliente?",
        answer: "Vá em 'Clientes' no menu lateral, clique em 'Novo Cliente' e preencha os dados. Você também pode cadastrar clientes rapidamente ao criar uma nova OS."
      },
      {
        question: "Qual a diferença entre os planos?",
        answer: "O plano Moto Pro é focado em oficinas de motos, enquanto o Oficina Pro inclui carros e motos. Acesse Configurações → Plano e Pagamento para ver todos os detalhes."
      }
    ]
  },
  {
    id: "celular",
    icon: Smartphone,
    title: "Celular e App",
    color: "text-accent",
    bgColor: "bg-accent/10",
    items: [
      {
        question: "Como instalar no celular?",
        answer: "O sistema funciona como um aplicativo quando instalado na tela inicial. No iPhone: toque Compartilhar → Adicionar à Tela de Início. No Android: toque os 3 pontinhos → Instalar app. Acesse /instalar para instruções passo a passo."
      },
      {
        question: "Funciona sem internet?",
        answer: "Sim, após instalado na tela inicial o sistema funciona em grande parte offline. Dados já carregados podem ser consultados mesmo sem conexão. Alterações são salvas quando a internet voltar."
      },
      {
        question: "Como atualizar o app?",
        answer: "O sistema atualiza automaticamente quando você abre pelo navegador. Se notar algo desatualizado, vá em Configurações e use a opção 'Forçar Atualização' para limpar o cache."
      },
      {
        question: "O app aparece na Play Store ou App Store?",
        answer: "Não. É um aplicativo web (PWA) que se instala direto pelo navegador, sem precisar de loja de apps. Mais rápido, sem burocracia e sempre atualizado."
      }
    ]
  },
  {
    id: "servicos",
    icon: Wrench,
    title: "Ordens de Serviço",
    color: "text-accent",
    bgColor: "bg-accent/10",
    items: [
      {
        question: "Como mudar o status de uma OS?",
        answer: "Na lista de serviços, clique na OS desejada, depois clique no botão de status e escolha o novo status. Você também pode usar o modo Kanban para arrastar as OS entre colunas."
      },
      {
        question: "Como enviar orçamento por WhatsApp?",
        answer: "Abra a OS, clique no ícone do WhatsApp. Uma mensagem formatada será aberta no WhatsApp com todos os detalhes do serviço."
      },
      {
        question: "Como adicionar fotos na OS?",
        answer: "Ao criar ou editar uma OS, role até a seção 'Fotos de Entrada/Saída' e clique para adicionar imagens do veículo."
      },
      {
        question: "O que significa cada status?",
        answer: "Aguardando: OS criada, aguardando início. Em Andamento: trabalho em execução. Aguardando Peça: pausado aguardando material. Finalizado: serviço concluído. Cancelado: OS cancelada."
      }
    ]
  },
  {
    id: "orcamentos",
    icon: FileText,
    title: "Orçamentos",
    color: "text-info",
    bgColor: "bg-info/10",
    items: [
      {
        question: "Como criar um orçamento?",
        answer: "Acesse 'Orçamentos' no menu, clique em 'Novo Orçamento'. Adicione cliente, veículo, itens (peças e serviços) e defina a validade."
      },
      {
        question: "Como converter orçamento em OS?",
        answer: "Abra o orçamento aprovado e clique em 'Converter em OS'. Os dados serão transferidos automaticamente para uma nova ordem de serviço."
      },
      {
        question: "O cliente pode aprovar online?",
        answer: "Sim! Envie o link do orçamento pelo WhatsApp. O cliente pode visualizar e aprovar diretamente pelo celular."
      }
    ]
  },
  {
    id: "financeiro",
    icon: DollarSign,
    title: "Financeiro",
    color: "text-success",
    bgColor: "bg-success/10",
    items: [
      {
        question: "Como registrar uma despesa?",
        answer: "Vá em 'Financeiro', clique em 'Nova Movimentação', selecione tipo 'Saída', preencha a descrição, valor e data. Você pode categorizar para melhor organização."
      },
      {
        question: "As entradas das OS são registradas automaticamente?",
        answer: "Sim! Quando você finaliza uma OS com valor, uma entrada é criada automaticamente no financeiro vinculada àquela ordem de serviço."
      },
      {
        question: "Como gerar relatório para o contador?",
        answer: "No Financeiro, use o filtro de data para selecionar o período, depois clique em 'Exportar'. O relatório inclui todas as movimentações categorizadas."
      }
    ]
  },
  {
    id: "clientes",
    icon: Users,
    title: "Clientes",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    items: [
      {
        question: "Como ver o histórico de um cliente?",
        answer: "Acesse 'Clientes', clique no cliente desejado. Você verá todos os veículos e histórico de serviços realizados."
      },
      {
        question: "O cliente pode acessar os dados dele?",
        answer: "Sim! Cada cliente tem um portal exclusivo onde pode ver histórico de serviços e orçamentos. Envie o link pelo WhatsApp."
      }
    ]
  },
  {
    id: "veiculos",
    icon: Car,
    title: "Veículos",
    color: "text-highlight",
    bgColor: "bg-highlight/10",
    items: [
      {
        question: "Como cadastrar um veículo?",
        answer: "Vá em 'Veículos', clique em 'Novo Veículo'. Selecione o cliente dono, preencha marca, modelo, placa e quilometragem atual."
      },
      {
        question: "O que é o histórico elétrico?",
        answer: "Para auto elétricas, o sistema mantém um histórico detalhado de diagnósticos e padrões de recorrência, ajudando a identificar problemas repetitivos."
      }
    ]
  },
  {
    id: "estoque",
    icon: Package,
    title: "Estoque",
    color: "text-warning",
    bgColor: "bg-warning/10",
    items: [
      {
        question: "Como dar entrada no estoque?",
        answer: "Acesse 'Estoque', clique em 'Nova Peça' ou edite uma existente e adicione a quantidade. O sistema registra o histórico de movimentações."
      },
      {
        question: "Como configurar alertas de estoque baixo?",
        answer: "Ao cadastrar ou editar um item, defina a 'Quantidade Mínima'. Quando atingir esse valor, você receberá um alerta no dashboard."
      },
      {
        question: "O estoque baixa automaticamente ao usar em OS?",
        answer: "Sim! Quando você adiciona peças do estoque em uma OS e a finaliza, a quantidade é automaticamente descontada."
      }
    ]
  },
  {
    id: "agenda",
    icon: Calendar,
    title: "Agenda",
    color: "text-info",
    bgColor: "bg-info/10",
    items: [
      {
        question: "Como agendar um serviço?",
        answer: "Acesse 'Agenda', clique no horário desejado ou use 'Novo Agendamento'. Vincule a um cliente e veículo, defina data e hora."
      },
      {
        question: "Posso configurar lembretes?",
        answer: "Sim! Em Configurações → Notificações, ative os lembretes. Você será notificado sobre agendamentos próximos."
      }
    ]
  },
  {
    id: "autoeletrica",
    icon: Zap,
    title: "Auto Elétrica",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    items: [
      {
        question: "Como usar o modo Auto Elétrica?",
        answer: "Ao criar sua oficina, selecione o tipo 'Auto Elétrica'. O sistema adaptará a terminologia e funcionalidades para diagnósticos elétricos."
      },
      {
        question: "O que é o Histórico Elétrico?",
        answer: "É uma timeline inteligente que mostra todos os diagnósticos de um veículo, identificando padrões de recorrência e alertando sobre possíveis problemas sistêmicos."
      },
      {
        question: "Como registrar códigos de erro OBD?",
        answer: "Ao criar uma OS de diagnóstico, use o campo de descrição para registrar os códigos encontrados. O sistema mantém esse histórico vinculado ao veículo."
      }
    ]
  },
  {
    id: "seguranca",
    icon: Shield,
    title: "Segurança e Conta",
    color: "text-success",
    bgColor: "bg-success/10",
    items: [
      {
        question: "Como alterar minha senha?",
        answer: "Acesse Configurações → Segurança → Alterar Senha. Digite a senha atual e a nova senha duas vezes para confirmar."
      },
      {
        question: "Como adicionar funcionários?",
        answer: "Vá em Configurações → Equipe → Convidar Membro. Defina o nível de acesso (administrador ou funcionário) e envie o convite por e-mail."
      },
      {
        question: "Meus dados estão seguros?",
        answer: "Sim! Utilizamos criptografia de ponta a ponta, backups automáticos e servidores seguros. Consulte nossa Política de Privacidade para mais detalhes."
      }
    ]
  }
];

export default function CentralAjuda() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredCategories = helpCategories.map(category => ({
    ...category,
    items: category.items.filter(item =>
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

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

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Central de Ajuda</h1>
          <p className="text-muted-foreground">
            Encontre respostas para suas dúvidas sobre o Mechanic Raiz Pro
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por palavra-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12"
          />
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <div key={category.id} className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-muted/30">
                <div className={`w-10 h-10 rounded-lg ${category.bgColor} flex items-center justify-center`}>
                  <category.icon className={`w-5 h-5 ${category.color}`} />
                </div>
                <h2 className="text-lg font-semibold text-foreground">{category.title}</h2>
              </div>
              
              <Accordion type="single" collapsible className="px-4">
                {category.items.map((item, index) => (
                  <AccordionItem key={index} value={`${category.id}-${index}`}>
                    <AccordionTrigger className="text-left text-foreground hover:text-primary">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum resultado encontrado para "{search}"</p>
            <Button variant="link" onClick={() => setSearch("")}>
              Limpar busca
            </Button>
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-12 p-6 bg-primary/5 border border-primary/20 rounded-xl text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Não encontrou o que procurava?
          </h3>
          <p className="text-muted-foreground mb-4">
            Nossa equipe está pronta para te ajudar
          </p>
          <Button
            onClick={() => window.open("https://wa.me/5511950891497?text=Olá! Preciso de ajuda com o Mechanic Raiz Pro", "_blank")}
            className="bg-green-600 hover:bg-green-700"
          >
            Falar no WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
