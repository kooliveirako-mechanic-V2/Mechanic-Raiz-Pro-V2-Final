import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";

interface PlanConfig {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  moto_pro: {
    id: "moto_pro",
    name: "Moto Pro",
    monthlyPrice: 47.90,
    annualPrice: 479.00,
    features: [
      "Clientes ilimitados",
      "Veículos (apenas motos)",
      "Ordens de Serviço",
      "Agenda de serviços",
      "Financeiro básico",
      "Histórico de serviços"
    ]
  },
  carro_pro: {
    id: "carro_pro",
    name: "Carro Pro",
    monthlyPrice: 67.90,
    annualPrice: 679.00,
    features: [
      "Clientes ilimitados",
      "Veículos (apenas carros)",
      "Ordens de Serviço",
      "Agenda de serviços",
      "Orçamentos profissionais",
      "Controle de estoque",
      "Financeiro com lucro",
      "Relatórios e gráficos",
      "Dashboard profissional",
      "Auto Elétrica inclusa"
    ]
  },
  oficina_completa: {
    id: "oficina_completa",
    name: "Oficina Completa",
    monthlyPrice: 97.90,
    annualPrice: 979.00,
    features: [
      "Tudo do Moto Pro",
      "Tudo do Carro Pro",
      "Veículos (carros e motos)",
      "Orçamentos profissionais",
      "Estoque completo",
      "Financeiro avançado (DRE)",
      "Relatórios avançados",
      "Dashboard completo",
      "Auto Elétrica inclusa"
    ]
  }
};

export function useUpgradePlan() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { oficinaAtual } = useOficina();

  const createUpgradePreference = async (targetPlan: string, billingCycle: 'monthly' | 'annual' = 'monthly') => {
    setError(null);

    if (!oficinaAtual?.id) {
      const errorMsg = "Oficina não encontrada. Faça login novamente.";
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    const plan = PLANS[targetPlan];
    if (!plan) {
      const errorMsg = "Plano não encontrado";
      setError(errorMsg);
      toast.error(errorMsg);
      return null;
    }

    const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
    const billingPeriod = billingCycle === 'annual' ? 'anual' : 'mensal';

    setIsLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData?.user?.email;

      // Backend only accepts: moto_pro | oficina_pro
      // carro_pro and oficina_completa both map to oficina_pro
      const backendPlanType = targetPlan === 'moto_pro' ? 'moto_pro' : 'oficina_pro';
      
      const requestBody = {
        items: [
          {
            title: `Assinatura ${plan.name} (${billingPeriod})`,
            description: `Plano ${billingPeriod} ${plan.name} - Mechanic Raiz Pro`,
            unit_price: price,
            quantity: 1,
          }
        ],
        payer: {
          email: userEmail || undefined,
        },
        type: "subscription" as const,
        plan_type: backendPlanType,
        oficina_id: oficinaAtual.id,
        external_reference: `subscription:${oficinaAtual.id}:${backendPlanType}`,
        metadata: {
          tipo: "subscription",
          oficina_id: oficinaAtual.id,
          plan_type: backendPlanType,
          original_plan: targetPlan,
          billing_cycle: billingCycle,
        }
      };

      const response = await supabase.functions.invoke("mercadopago-create-preference", {
        body: requestBody
      });

      if (response.error) {
        const errorMsg = "Erro ao criar pagamento. Tente novamente.";
        setError(errorMsg);
        toast.error(errorMsg, {
          description: response.error.message || "Erro na comunicação com o servidor"
        });
        return null;
      }

      if (response.data?.error) {
        const errorMsg = response.data.error;
        setError(errorMsg);
        toast.error(errorMsg);
        return null;
      }

      return response.data;

    } catch (err) {
      const errorMsg = "Erro ao processar upgrade. Tente novamente.";
      setError(errorMsg);
      toast.error(errorMsg, {
        description: err instanceof Error ? err.message : "Erro desconhecido"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const redirectToCheckout = async (targetPlan: string, billingCycle: 'monthly' | 'annual' = 'monthly') => {
    const preference = await createUpgradePreference(targetPlan, billingCycle);
    
    if (preference?.init_point) {
      toast.loading("Redirecionando para pagamento...");
      window.location.href = preference.init_point;
    }
  };

  return {
    isLoading,
    error,
    createUpgradePreference,
    redirectToCheckout,
    plans: PLANS,
  };
}
