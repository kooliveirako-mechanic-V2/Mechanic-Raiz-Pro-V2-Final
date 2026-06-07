import { useEffect } from "react";
import { trackEvent } from "@/lib/tracking";

// IDs sincronizados com a DOM real (LandingSections.tsx, PricingSection.tsx, etc.)
const TRACKED_SECTIONS = [
  { id: "hero", name: "Hero" },
  { id: "para-quem", name: "Para Quem É" },
  { id: "ordem-de-servico", name: "O Que Resolve" },
  { id: "como-funciona", name: "How It Works" },
  { id: "beneficios", name: "Benefícios" },
  { id: "simulador", name: "Simulator" },
  { id: "planos", name: "Pricing" },
  { id: "garantia", name: "Garantia" },
  { id: "faq", name: "FAQ" },
  { id: "cta-final", name: "Final CTA" },
];

export function SectionTracker() {
  useEffect(() => {
    const observed = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !observed.has(entry.target.id)) {
            observed.add(entry.target.id);
            const section = TRACKED_SECTIONS.find(s => s.id === entry.target.id);
            if (!section) return;
            // [Fase B] gtag() e dataLayer.push manuais removidos — agora via trackEvent
            // (single source of truth: dataLayer 1x + sem duplicar Pixel/CAPI).
            trackEvent("section_viewed", {
              params: {
                event_category: "scroll_engagement",
                event_label: section.id,
                section_id: section.id,
                section_name: section.name,
              },
              skipPixel: true,
              skipMocapi: true,
            });
          }
        });
      },
      { threshold: 0.5 }
    );

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      TRACKED_SECTIONS.forEach(({ id }) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    }, 1000);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
