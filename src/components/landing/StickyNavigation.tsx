import React, { useState, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Para quem é", href: "#para-quem" },
  { label: "O que resolve", href: "#ordem-de-servico" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

interface StickyNavigationProps {
  onScrollToTop: () => void;
  onScrollToLogin: () => void;
  onScrollToSignup?: () => void;
}

export const StickyNavigation = forwardRef<HTMLElement, StickyNavigationProps>(
  ({ onScrollToTop, onScrollToLogin, onScrollToSignup }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState("");

    useEffect(() => {
      const handleScroll = () => {
        setIsVisible(window.scrollY > 600);

        const sections = navItems.map((item) => item.href.replace("#", ""));
        for (const section of [...sections].reverse()) {
          const element = document.getElementById(section);
          if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.top <= 150) {
              setActiveSection(section);
              break;
            }
          }
        }
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToSection = (href: string) => {
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      setIsMobileMenuOpen(false);
    };

    return (
      <AnimatePresence>
        {isVisible && (
          <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed top-0 left-0 right-0 z-50 bg-[#0E1B2A]/95 backdrop-blur-md border-b border-white/10"
          >
            <div className="container mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between h-14 sm:h-16">
                {/* Logo */}
                <button onClick={onScrollToTop} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0077B6] to-[#00A8E8] flex items-center justify-center">
                    <Wrench className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white font-bold text-sm sm:text-lg">Mechanic Raiz Pro</span>
                </button>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => (
                    <button
                      key={item.href}
                      onClick={() => scrollToSection(item.href)}
                      className={`px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        activeSection === item.href.replace("#", "")
                          ? "text-white bg-white/10"
                          : "text-white/70 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* CTA Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={onScrollToLogin}
                    size="sm"
                    className="bg-transparent border border-white/30 text-white hover:bg-white/10 font-semibold hidden sm:flex"
                  >
                    Entrar
                  </Button>
                  <Button
                    onClick={onScrollToSignup || onScrollToTop}
                    size="sm"
                    className="cta-track bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/30 flex"
                  >
                    Teste grátis por 14 dias
                  </Button>

                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 text-white"
                  >
                    {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </button>
                </div>
              </div>

              {/* Mobile Menu */}
              <AnimatePresence>
                {isMobileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="md:hidden border-t border-white/10 py-4"
                  >
                    <div className="flex flex-col gap-2">
                      {navItems.map((item) => (
                        <button
                          key={item.href}
                          onClick={() => scrollToSection(item.href)}
                          className={`px-4 py-3 rounded-lg text-left font-medium transition-all ${
                            activeSection === item.href.replace("#", "")
                              ? "text-white bg-white/10"
                              : "text-white/70 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                      <Button
                        onClick={() => {
                          onScrollToLogin();
                          setIsMobileMenuOpen(false);
                        }}
                        className="mt-2 bg-transparent border border-white/30 text-white hover:bg-white/10 font-semibold"
                      >
                        Entrar
                      </Button>
                      <Button
                        onClick={() => {
                          (onScrollToSignup || onScrollToTop)();
                          setIsMobileMenuOpen(false);
                        }}
                        className="cta-track bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold"
                      >
                        Teste grátis por 14 dias
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    );
  }
);

StickyNavigation.displayName = "StickyNavigation";
