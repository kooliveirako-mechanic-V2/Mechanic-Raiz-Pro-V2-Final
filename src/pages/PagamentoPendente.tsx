import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Home, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PagamentoPendente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const paymentId = searchParams.get('payment_id');
  const externalReference = searchParams.get('external_reference');
  const isOrcamento = externalReference?.startsWith('orcamento:');

  return (
    <div className="min-h-screen bg-gradient-to-br from-warning/10 to-warning/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="text-center shadow-xl border-warning/30">
          <CardHeader className="pb-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4"
            >
              <Clock className="h-20 w-20 text-warning" />
            </motion.div>
            <CardTitle className="text-2xl text-warning">
              Pagamento Pendente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Seu pagamento está sendo processado. Você será notificado quando for confirmado.
            </p>
            
            <div className="bg-warning/10 p-4 rounded-lg text-left">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  PIX: até 30 min • Boleto: até 3 dias úteis
                </p>
              </div>
            </div>
            
            {paymentId && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">ID do Pagamento</p>
                <p className="font-mono text-sm">{paymentId}</p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate('/')} className="w-full bg-warning hover:bg-warning/90 text-warning-foreground">
                <Home className="mr-2 h-4 w-4" />
                Ir para o Início
              </Button>
              {!isOrcamento && (
                <Button variant="outline" onClick={() => navigate('/notificacoes')} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Ver Notificações
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}