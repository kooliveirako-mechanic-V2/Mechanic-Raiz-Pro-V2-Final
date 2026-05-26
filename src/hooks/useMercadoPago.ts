import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlanItem {
  title: string;
  description: string;
  unit_price: number;
  quantity: number;
}

interface CreatePreferenceParams {
  items: PlanItem[];
  payer?: {
    email?: string;
    name?: string;
  };
  external_reference?: string;
  oficina_id?: string;
  orcamento_id?: string;
  metadata?: Record<string, unknown>;
}

interface PreferenceResponse {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export function useMercadoPago() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPreference = async (params: CreatePreferenceParams): Promise<PreferenceResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('mercadopago-create-preference', {
        body: params,
      });

      if (fnError) {
        console.error('Error invoking function:', fnError);
        setError(fnError.message);
        toast.error('Erro ao criar pagamento');
        return null;
      }

      if (data.error) {
        console.error('API error:', data.error);
        setError(data.error);
        toast.error(data.error);
        return null;
      }

      return data as PreferenceResponse;
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Erro inesperado ao processar pagamento');
      toast.error('Erro inesperado ao processar pagamento');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const redirectToCheckout = async (params: CreatePreferenceParams) => {
    const preference = await createPreference(params);
    
    if (preference) {
      // Use init_point for production
      window.location.href = preference.init_point;
    }
  };

  return {
    loading,
    error,
    createPreference,
    redirectToCheckout,
  };
}
