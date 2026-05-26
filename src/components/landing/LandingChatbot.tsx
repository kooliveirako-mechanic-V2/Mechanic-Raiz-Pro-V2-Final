import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackContactAndOpenWpp } from "@/lib/oracleWpp";

type Message = { role: "user" | "assistant"; content: string };

type ChatPhase = "greeting" | "type_select" | "chat";

const WORKSHOP_TYPES = [
  { label: "🏍️ Mecânica de Moto", value: "moto" },
  { label: "🚗 Mecânica de Carro", value: "carro" },
  { label: "⚡ Auto Elétrica", value: "eletrica" },
  { label: "🔧 Moto + Carro + Elétrica", value: "todos" },
];

const INITIAL_QUESTIONS: Record<string, string[]> = {
  moto: [
    "Quanto custa pra oficina de moto?",
    "Funciona no celular?",
    "Controla estoque de peças?",
    "Como testar grátis?",
  ],
  carro: [
    "Quanto custa pra oficina de carro?",
    "Funciona no celular?",
    "Faz orçamento pro cliente?",
    "Como testar grátis?",
  ],
  eletrica: [
    "Tem checklist DVI elétrico?",
    "Quanto custa o plano Oficina Completa?",
    "Controla diagnóstico elétrico?",
    "Como testar grátis?",
  ],
  todos: [
    "Quanto custa o plano Oficina Completa?",
    "Funciona pra moto e carro junto?",
    "Tem checklist DVI?",
    "Como testar grátis?",
  ],
};

const COMMON_QUESTIONS = [
  "Quanto custa?",
  "Funciona no celular?",
  "Como instalar no celular?",
  "Funciona sem internet?",
  "Precisa de computador?",
  "É difícil de usar?",
  "Posso cancelar quando quiser?",
  "Emite nota fiscal?",
  "Quantas OS posso criar?",
  "Meus dados ficam salvos?",
  "Tem suporte humano?",
  "Serve pra auto elétrica?",
  "Posso mudar de plano depois?",
  "Quanto tempo leva pra começar?",
  "Como funciona o pagamento?",
  "E se eu uso caderninho/planilha?",
];

const FOLLOWUP_MAP: Record<string, string[]> = {
  "Quanto custa?": ["Qual plano é melhor pra mim?", "Tem desconto no anual?", "Posso testar antes?"],
  "Quanto custa pra oficina de moto?": ["Tem desconto no anual?", "Posso testar antes?", "O que inclui?"],
  "Quanto custa pra oficina de carro?": ["Tem desconto no anual?", "Posso testar antes?", "O que inclui?"],
  "Quanto custa o plano Oficina Completa?": ["O que tem de especial?", "Tem desconto no anual?", "Quero testar grátis!"],
  "Funciona no celular?": ["Como instalar no celular?", "Funciona sem internet?", "Precisa de computador?"],
  "Como instalar no celular?": ["Funciona no iPhone?", "E no Android?", "Quero testar grátis!"],
  "Como testar grátis?": ["Precisa de cartão?", "O que acontece depois dos 14 dias?", "Posso cancelar?"],
  "Serve pra auto elétrica?": ["O que tem de especial pra elétrica?", "Quanto custa o Oficina Completa?", "Quero testar grátis!"],
  "Funciona pra moto e carro junto?": ["Quanto custa o Oficina Completa?", "Quero testar grátis!"],
  "Tem checklist DVI elétrico?": ["Como funciona o DVI?", "Quero testar grátis!"],
  "Tem checklist DVI?": ["Como funciona o DVI?", "Quero testar grátis!"],
  "Controla estoque de peças?": ["Alerta quando acaba?", "Calcula lucro?", "Quero testar grátis!"],
  "Controla diagnóstico elétrico?": ["Tem histórico do veículo?", "Quero testar grátis!"],
  "Faz orçamento pro cliente?": ["Envia pelo WhatsApp?", "Quero testar grátis!"],
  "É difícil de usar?": ["Quanto tempo leva pra começar?", "Tem suporte?", "Quero testar grátis!"],
  "Emite nota fiscal?": ["Como funciona o pré-fiscal?", "Quero testar grátis!"],
};

const DEFAULT_FOLLOWUPS = [
  "Quero testar grátis!",
  "Falar com suporte humano",
  "Ver os planos e preços",
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const CHAT_URL = `${SUPABASE_URL}/functions/v1/landing-chatbot`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const WHATSAPP_URL = "https://wa.me/5511950891497";

export function LandingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<ChatPhase>("greeting");
  const [workshopType, setWorkshopType] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [lastQuestion, setLastQuestion] = useState("");
  const [showMoreQuestions, setShowMoreQuestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, followUps, phase, showMoreQuestions]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleSelectType = (type: string, label: string) => {
    setWorkshopType(type);
    setPhase("chat");
    setMessages([
      { role: "user", content: label },
      { role: "assistant", content: `Show! 💪 Conheço bem a rotina de quem trabalha com ${label.replace(/^[^\s]+\s/, "")}.\n\nO Mechanic Raiz Pro tem tudo que você precisa pra organizar sua oficina. Me pergunta qualquer coisa! 👇` },
    ]);
    setFollowUps([]);
  };

  const handleRestart = () => {
    setPhase("greeting");
    setWorkshopType("");
    setMessages([]);
    setFollowUps([]);
    setLastQuestion("");
    setShowMoreQuestions(false);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const trimmed = text.trim();
    setLastQuestion(trimmed);
    setFollowUps([]);
    setShowMoreQuestions(false);

    if (trimmed === "Falar com suporte humano") {
      trackContactAndOpenWpp("chatbot_fallback", {
        message: "Olá! Tenho uma dúvida sobre o Mechanic Raiz Pro",
      });
      return;
    }
    if (trimmed === "Ver os planos e preços") {
      const el = document.getElementById("precos");
      if (el) { el.scrollIntoView({ behavior: "smooth" }); setIsOpen(false); }
      return;
    }
    if (trimmed === "Quero começar agora!" || trimmed === "Quero testar grátis!") {
      window.location.href = "/auth";
      return;
    }
    if (trimmed === "Tentar de novo" && lastQuestion) {
      sendMessage(lastQuestion);
      return;
    }
    if (trimmed === "Ver mais perguntas") {
      setShowMoreQuestions(true);
      return;
    }

    const userMsg: Message = { role: "user", content: trimmed };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    setShowPulse(false);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error("Falha na conexão");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      const mapped = FOLLOWUP_MAP[trimmed];
      setFollowUps(mapped || DEFAULT_FOLLOWUPS);
    } catch (error) {
      console.error("Chatbot error:", error);
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Ops, tive um problema pra responder. Que tal falar direto com nosso time no WhatsApp? 🤙" },
      ]);
      setFollowUps(["Falar com suporte humano", "Tentar de novo"]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, lastQuestion]);

  const handleWhatsAppRedirect = () => {
    const lastUserMsg = messages.filter(m => m.role === "user").pop();
    const text = lastUserMsg
      ? `Olá! Estava conversando com o chatbot e tenho uma dúvida: ${lastUserMsg.content}`
      : "Olá! Tenho uma dúvida sobre o Mechanic Raiz Pro";
    trackContactAndOpenWpp("chatbot_fallback", { message: text });
  };

  const currentQuestions = INITIAL_QUESTIONS[workshopType] || INITIAL_QUESTIONS["todos"];

  return (
    <>
      <AnimatePresence>
        {!isOpen ? (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[#00A8E8] text-white shadow-xl shadow-primary/40 flex items-center justify-center hover:scale-110 transition-transform"
            aria-label="Abrir chat"
          >
            <MessageCircle className="w-7 h-7" />
            {showPulse && (
              <>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF7A18] rounded-full animate-pulse flex items-center justify-center text-[9px] font-bold">1</span>
                <span className="absolute inset-0 rounded-full bg-[#00A8E8] animate-ping opacity-20" />
              </>
            )}
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-[380px] h-[520px] max-h-[80vh] bg-[#0E1B2A] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#0077B6] to-[#00A8E8] text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-sm">Mechanic Raiz Pro</p>
                  <p className="text-xs text-white/80">
                    {isLoading ? "Digitando..." : "Tire suas dúvidas"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {phase === "chat" && (
                  <button
                    onClick={handleRestart}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                    title="Recomeçar conversa"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Phase: Greeting */}
              {phase === "greeting" && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/90">
                    Fala, amigo 👋
                    {"\n\n"}Pra eu te mostrar só o que faz sentido pra sua oficina, me conta rapidinho:
                  </div>
                  <p className="text-xs text-white/50 font-medium">Sua oficina é de qual tipo?</p>
                  <div className="flex flex-col gap-2">
                    {WORKSHOP_TYPES.map((t, i) => (
                      <button
                        key={t.value}
                        onClick={() => handleSelectType(t.value, t.label)}
                        className="flex items-center gap-3 text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-[#0077B6]/20 hover:border-[#0077B6]/40 transition-all text-left text-white/90"
                      >
                        <span className="w-6 h-6 rounded-full bg-[#0077B6]/30 text-[#00A8E8] flex items-center justify-center text-xs font-bold">{i + 1}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Phase: Type selected -> show contextual questions */}
              {phase === "chat" && messages.length <= 2 && !isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 mt-1">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-[#0077B6] text-white rounded-br-sm" : "bg-white/10 text-white/90 rounded-bl-sm"}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-white/50 font-medium pt-2">Perguntas frequentes:</p>
                  <div className="flex flex-wrap gap-2">
                    {currentQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs bg-[#0077B6]/20 text-[#00A8E8] border border-[#0077B6]/30 rounded-full px-3 py-1.5 hover:bg-[#0077B6]/40 hover:scale-105 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowMoreQuestions(!showMoreQuestions)}
                      className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-all"
                    >
                      {showMoreQuestions ? "Menos perguntas ▲" : "Mais perguntas ▼"}
                    </button>
                  </div>
                  {showMoreQuestions && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-2 pt-1">
                      {COMMON_QUESTIONS.filter(q => !currentQuestions.includes(q)).map((q) => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="text-xs bg-white/5 text-white/60 border border-white/10 rounded-full px-3 py-1.5 hover:bg-[#0077B6]/20 hover:text-[#00A8E8] transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Normal chat messages (after initial) */}
              {phase === "chat" && (messages.length > 2 || isLoading) && (
                <>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-[#0077B6] text-white rounded-br-sm" : "bg-white/10 text-white/90 rounded-bl-sm"}`}>
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </>
              )}

              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-white/10 rounded-xl px-3 py-2 text-sm text-white/60 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              {/* Follow-up suggestions */}
              {!isLoading && followUps.length > 0 && phase === "chat" && messages.length > 2 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 pt-1">
                  <p className="text-xs text-white/40">Quer saber mais?</p>
                  <div className="flex flex-wrap gap-2">
                    {followUps.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs bg-[#FF7A18]/10 text-[#FF7A18] border border-[#FF7A18]/30 rounded-full px-3 py-1.5 hover:bg-[#FF7A18]/20 hover:scale-105 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowMoreQuestions(!showMoreQuestions)}
                      className="text-xs bg-white/5 text-white/50 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/10 transition-all"
                    >
                      {showMoreQuestions ? "Menos ▲" : "Mais perguntas ▼"}
                    </button>
                  </div>
                  {showMoreQuestions && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-2 pt-1">
                      {COMMON_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="text-xs bg-white/5 text-white/60 border border-white/10 rounded-full px-3 py-1.5 hover:bg-[#0077B6]/20 hover:text-[#00A8E8] transition-all"
                        >
                          {q}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* WhatsApp fallback */}
            {messages.length >= 4 && (
              <div className="px-4 pb-2">
                <button
                  onClick={handleWhatsAppRedirect}
                  className="w-full flex items-center justify-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors py-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Prefere falar com uma pessoa? Chame no WhatsApp
                </button>
              </div>
            )}

            {/* Input */}
            {phase === "chat" && (
              <div className="p-3 border-t border-white/10">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                  className="flex gap-2"
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite sua dúvida..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[#0077B6]/50"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isLoading || !input.trim()}
                    className="rounded-xl bg-[#0077B6] hover:bg-[#0077B6]/80 h-9 w-9 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
