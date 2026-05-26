import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { trackContactAndOpenWpp } from "@/lib/oracleWpp";

export function RegistrationHelpBubble() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
      if (typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', 'help_bubble_shown', {
          event_category: 'engagement',
          event_label: 'registration_30s',
        });
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="absolute -bottom-16 left-0 right-0 mx-auto w-fit z-20"
    >
      <div className="relative bg-emerald-500 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-emerald-500" />
        
        <MessageCircle className="w-4 h-4 flex-shrink-0" />
        <span>Dúvida?</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            trackContactAndOpenWpp("bolha_cadastro", {
              message: "Olá! Estou tentando me cadastrar no Mechanic Raiz Pro e tenho uma dúvida",
            });
          }}
          className="underline font-bold hover:text-emerald-100 cursor-pointer"
        >
          Chame no Zap
        </a>
        <button onClick={() => setShow(false)} className="ml-1 p-0.5 hover:bg-emerald-600 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
