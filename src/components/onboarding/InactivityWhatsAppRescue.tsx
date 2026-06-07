import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGamification } from "@/hooks/useGamification";

const RESCUE_DISMISSED_KEY = "mechpro_rescue_dismissed";
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WHATSAPP_SUPPORT = "https://wa.me/5511950891497?text=Oi%21%20Criei%20minha%20conta%20no%20Mechanic%20Raiz%20Pro%20e%20preciso%20de%20ajuda%20pra%20come%C3%A7ar.";

export function InactivityWhatsAppRescue() {
  const [show, setShow] = useState(false);
  const { activation } = useGamification();

  const resetTimer = useCallback(() => {
    // If already dismissed or user has completed steps, don't track
    const dismissed = localStorage.getItem(RESCUE_DISMISSED_KEY);
    if (dismissed) return;

    // Clear existing timer
    const existingTimer = (window as any).__inactivityTimer;
    if (existingTimer) clearTimeout(existingTimer);

    // Set new timer
    (window as any).__inactivityTimer = setTimeout(() => {
      // Only show if user hasn't completed any onboarding steps
      if (activation.percentComplete === 0) {
        setShow(true);
      }
    }, INACTIVITY_TIMEOUT_MS);
  }, [activation.percentComplete]);

  useEffect(() => {
    const dismissed = localStorage.getItem(RESCUE_DISMISSED_KEY);
    if (dismissed) return;

    // Track user activity
    const events = ["click", "scroll", "keydown", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    
    // Start initial timer
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      const timer = (window as any).__inactivityTimer;
      if (timer) clearTimeout(timer);
    };
  }, [resetTimer]);

  // Hide if user starts completing steps
  useEffect(() => {
    if (activation.percentComplete > 0) {
      setShow(false);
    }
  }, [activation.percentComplete]);

  const handleDismiss = () => {
    localStorage.setItem(RESCUE_DISMISSED_KEY, "true");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-20 right-4 z-50 max-w-[300px]"
        >
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl shadow-black/20 overflow-hidden">
            {/* Close */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Precisa de ajuda?</p>
                  <p className="text-[11px] text-muted-foreground">Estamos online agora</p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Vi que você acabou de criar sua conta. Quer uma ajuda rápida pra configurar tudo?
              </p>

              <Button
                asChild
                size="sm"
                className="w-full gap-2 bg-success hover:bg-success/90 text-white font-semibold rounded-xl"
              >
                <a href={WHATSAPP_SUPPORT} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4" />
                  Falar no WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
