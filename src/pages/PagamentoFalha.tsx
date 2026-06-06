import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trackEvent } from '@/lib/tracking';


export default function PagamentoFalha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const paymentId = searchParams.get('payment_id');
  const externalReference = searchParams.get('external_reference');
  const status = searchParams.get('status') || 'rejected';
  
  const isSubscription = externalReference?.startsWith('subscription:');
  const planType = isSubscription ? externalReference?.split(':')[2] : undefined;

  // [Fase I] gtag('event','payment_failed') direto REMOVIDO. Agora dispara
  // exclusivamente via dataLayer → GTM, com Event ID={{DLV - event_id}}.
  useEffect(() => {
    const stableId = paymentId || `${planType || 'unknown'}:${status}:${Date.now()}`;
    trackEvent('payment_failed', {
      eventId: paymentId || undefined,
      dedupKey: `payment_failed:${stableId}`,
      dedupTtlMs: Number.POSITIVE_INFINITY,
      params: {
        transaction_id: paymentId || '',
        plan_type: planType,
        status,
        send_to: 'AW-17892212693',
      },
    });
  }, [paymentId, status, planType, externalReference]);

  const handleTryAgain = () => {
    if (isSubscription) {
      navigate('/upgrade');
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-destructive/10 to-destructive/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="text-center shadow-xl border-destructive/30">
          <CardHeader className="pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4"
            >
              <XCircle className="h-20 w-20 text-destructive" />
            </motion.div>
            <CardTitle className="text-2xl text-destructive">
              Pagamento não Aprovado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Infelizmente seu pagamento não foi aprovado. Verifique os dados e tente novamente.
            </p>
            
            <div className="bg-destructive/10 p-4 rounded-lg text-left space-y-2">
              <p className="font-medium text-destructive text-sm">O que fazer:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Verifique os dados do cartão</li>
                <li>• Tente outro método de pagamento</li>
                <li>• Use PIX para pagamento instantâneo</li>
              </ul>
            </div>
            
            {paymentId && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">ID da Tentativa</p>
                <p className="font-mono text-sm">{paymentId}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={handleTryAgain} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar Novamente
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                <Home className="mr-2 h-4 w-4" />
                Ir para o Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}