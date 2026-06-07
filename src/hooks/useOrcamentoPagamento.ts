import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

interface CreateOrcamentoPaymentParams {
  orcamentoId: string;
  valor: number;
  titulo: string;
  clienteEmail?: string;
  clienteNome?: string;
}

interface PaymentPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  external_reference: string;
}

/**
 * Hook para gerenciar pagamentos de orçamentos via Mercado Pago
 */
export function useOrcamentoPagamento() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { oficinaAtual } = useOficina();

  /**
   * Cria uma preferência de pagamento para um orçamento
   */
  const createPaymentLink = async (
    params: CreateOrcamentoPaymentParams
  ): Promise<PaymentPreference | null> => {
    if (!oficinaAtual?.id) {
      toast.error("Oficina não encontrada");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "mercadopago-create-preference",
        {
          body: {
            items: [
              {
                title: params.titulo,
                description: `Orçamento - ${oficinaAtual.nome}`,
                unit_price: params.valor,
                quantity: 1,
              },
            ],
            payer: {
              email: params.clienteEmail,
              name: params.clienteNome,
            },
            type: "orcamento",
            oficina_id: oficinaAtual.id,
            orcamento_id: params.orcamentoId,
            metadata: {
              tipo: "orcamento",
              oficina_id: oficinaAtual.id,
              orcamento_id: params.orcamentoId,
            },
          },
        }
      );

      if (fnError) {
        console.error("Error creating orcamento payment:", fnError);
        setError(fnError.message);
        toast.error("Erro ao gerar link de pagamento");
        return null;
      }

      if (data.error) {
        console.error("API error:", data.error);
        setError(data.error);
        toast.error(data.error);
        return null;
      }

      return data as PaymentPreference;
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Erro inesperado ao processar pagamento");
      toast.error("Erro inesperado ao processar pagamento");
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Gera o link de pagamento e copia para a área de transferência
   */
  const generateAndCopyLink = async (
    params: CreateOrcamentoPaymentParams
  ): Promise<string | null> => {
    const preference = await createPaymentLink(params);

    if (preference?.init_point) {
      await navigator.clipboard.writeText(preference.init_point);
      toast.success("Link de pagamento copiado!", {
        description: "Envie para o cliente realizar o pagamento",
      });
      return preference.init_point;
    }

    return null;
  };

  /**
   * Gera o link e abre o WhatsApp para enviar
   */
  const generateAndShareWhatsApp = async (
    params: CreateOrcamentoPaymentParams,
    telefone?: string
  ): Promise<void> => {
    const preference = await createPaymentLink(params);

    if (preference?.init_point) {
      const message = encodeURIComponent(
        `Olá! Segue o link para pagamento do orçamento:\n\n` +
          `📋 *${params.titulo}*\n` +
          `💰 Valor: R$ ${params.valor.toFixed(2)}\n\n` +
          `🔗 Link para pagamento:\n${preference.init_point}\n\n` +
          `Atenciosamente,\n${oficinaAtual?.nome || "Oficina"}`
      );

      const whatsappUrl = telefone
        ? `https://wa.me/${telefone.replace(/\D/g, "")}?text=${message}`
        : `https://wa.me/?text=${message}`;

      window.open(whatsappUrl, "_blank");
    }
  };

  return {
    loading,
    error,
    createPaymentLink,
    generateAndCopyLink,
    generateAndShareWhatsApp,
  };
}
