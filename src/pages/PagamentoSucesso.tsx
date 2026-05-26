import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Home, FileText, Sparkles, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { trackFunnelEvent } from '@/lib/funnelTracking';

type PaymentType = 'subscription' | 'orcamento' | 'unknown';
type VerificationStatus = 'idle' | 'verifying' | 'success' | 'pending' | 'failed';

function parseExternalReference(ref: string | null): {
  type: PaymentType;
  planType?: string;
  orcamentoId?: string;
} {
  if (!ref) return { type: 'unknown' };
  
  const parts = ref.split(':');
  
  if (parts[0] === 'subscription' && parts.length >= 3) {
    return { type: 'subscription', planType: parts[2] };
  }
  
  if (parts[0] === 'orcamento' && parts.length >= 3) {
    return { type: 'orcamento', orcamentoId: parts[2] };
  }
  
  return { type: 'unknown' };
}

export default function PagamentoSucesso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(8);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [activatedPlan, setActivatedPlan] = useState<string | null>(null);
  
  const paymentId = searchParams.get('payment_id');
  const externalReference = searchParams.get('external_reference');
  const parsedRef = parseExternalReference(externalReference);
  
  const isSubscription = parsedRef.type === 'subscription';
  const isOrcamento = parsedRef.type === 'orcamento';

  // Fire Google Ads + Meta Pixel conversion on page load
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-17892212693/idz9CJyC0uobENX_1dNC',
        'value': 1.0,
        'currency': 'BRL',
        'transaction_id': paymentId || '',
      });
    }
    // [Fase G] Pixel(Purchase) e CAPI(Purchase) REMOVIDOS — Meta agora é
    // configurado via Event Setup Tool lendo URL/DOM desta página de sucesso.


    if (isSubscription) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          const oficinaId = user.user_metadata?.oficina_id;
          if (oficinaId) {
            trackFunnelEvent({
              event: "checkout_completed",
              oficina_id: oficinaId,
              user_id: user.id,
              entity_id: paymentId || undefined,
              metadata: { payment_id: paymentId, plan: parsedRef.planType },
            });
          }
        }
      });
    }
  }, [paymentId, isSubscription]);

  useEffect(() => {
    async function verifyPayment() {
      if (!paymentId || !isSubscription) return;
      
      setVerificationStatus('verifying');
      
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment-status', {
          body: { payment_id: paymentId }
        });
        
        if (error) {
          console.error('❌ Erro ao verificar pagamento:', error);
          setVerificationStatus('failed');
          return;
        }
        
        if (data.status === 'approved') {
          setVerificationStatus('success');
          setActivatedPlan(data.plan_type || parsedRef.planType);
        } else if (data.status === 'pending' || data.status === 'in_process') {
          setVerificationStatus('pending');
        } else {
          setVerificationStatus('failed');
        }
      } catch (err) {
        console.error('❌ Erro inesperado:', err);
        setVerificationStatus('failed');
      }
    }

    verifyPayment();
  }, [paymentId, isSubscription, parsedRef.planType]);

  useEffect(() => {
    if (verificationStatus === 'success' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (verificationStatus === 'success' && countdown === 0) {
      navigate('/');
    }
  }, [verificationStatus, countdown, navigate]);

  const getPlanDisplayName = (plan: string | null | undefined) => {
    if (!plan) return 'Pro';
    if (plan === 'oficina_pro') return 'Oficina Completa';
    if (plan === 'moto_pro') return 'Moto Pro';
    if (plan === 'carro_pro') return 'Carro Pro';
    if (plan === 'oficina_completa') return 'Oficina Completa';
    return plan;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-success/10 to-success/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="text-center shadow-xl border-success/30">
          <CardHeader className="pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4"
            >
              {verificationStatus === 'verifying' ? (
                <div className="relative">
                  <Loader2 className="h-20 w-20 text-info animate-spin" />
                </div>
              ) : verificationStatus === 'pending' ? (
                <div className="relative">
                  <AlertCircle className="h-20 w-20 text-warning" />
                </div>
              ) : (
                <div className="relative">
                  <CheckCircle className="h-20 w-20 text-success" />
                  {isSubscription && verificationStatus === 'success' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.5 }}
                      className="absolute -top-2 -right-2"
                    >
                      <Sparkles className="h-8 w-8 text-accent" />
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
            
            <CardTitle className="text-2xl text-success">
              {verificationStatus === 'verifying' 
                ? 'Verificando Pagamento...'
                : verificationStatus === 'pending'
                ? 'Pagamento Pendente'
                : isSubscription 
                ? 'Upgrade Realizado!' 
                : 'Pagamento Aprovado!'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {verificationStatus === 'verifying' && (
              <p className="text-muted-foreground">
                Estamos confirmando seu pagamento com o Mercado Pago. Aguarde um momento...
              </p>
            )}

            {verificationStatus === 'pending' && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Seu pagamento está sendo processado. Isso pode levar alguns minutos.
                </p>
                <p className="text-sm text-warning">
                  Se você pagou via PIX, aguarde a confirmação. A ativação será automática.
                </p>
                <Button 
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Voltar para o Início
                </Button>
              </div>
            )}

            {verificationStatus === 'success' && isSubscription && (
              <>
                <div className="space-y-3">
                  <Badge className="bg-gradient-to-r from-accent to-accent/80 text-accent-foreground border-0 px-4 py-1">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {getPlanDisplayName(activatedPlan)}
                  </Badge>
                  <p className="text-muted-foreground">
                    Seu plano foi atualizado com sucesso! Agora você tem acesso a todos os recursos premium.
                  </p>
                </div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-success/10 p-4 rounded-lg space-y-2"
                >
                  <p className="font-medium text-success">
                    Recursos desbloqueados:
                  </p>
                  <ul className="text-sm text-left space-y-1.5 text-muted-foreground">
                    {[
                      "Veículos (carros e motos)",
                      "Orçamentos profissionais",
                      "Estoque completo",
                      "Relatórios e gráficos",
                      "Dashboard completo",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </motion.div>
                
                <p className="text-sm text-muted-foreground">
                  Redirecionando em {countdown}s...
                </p>
              </>
            )}

            {verificationStatus === 'failed' && (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Não foi possível confirmar seu pagamento automaticamente. 
                  Se você completou o pagamento, a ativação será feita em breve.
                </p>
                <Button 
                  onClick={() => navigate('/')}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Ir para o Início
                </Button>
              </div>
            )}

            {!isSubscription && (
              <p className="text-muted-foreground">
                {isOrcamento 
                  ? 'O pagamento do orçamento foi processado com sucesso. A oficina já foi notificada!'
                  : 'Seu pagamento foi processado com sucesso. Obrigado pela preferência!'
                }
              </p>
            )}
            
            {paymentId && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">ID do Pagamento</p>
                <p className="font-mono text-sm">{paymentId}</p>
              </div>
            )}

            {verificationStatus === 'success' && (
              <div className="flex flex-col gap-3 pt-2">
                <Button 
                  onClick={() => navigate('/')}
                  className="w-full bg-success hover:bg-success/90 text-success-foreground"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Ir para o Início
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                
                {!isOrcamento && (
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/servicos')}
                    className="w-full"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Ver Meus Serviços
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}