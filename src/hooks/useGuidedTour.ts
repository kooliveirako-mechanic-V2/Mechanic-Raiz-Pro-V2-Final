import { useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useOficina } from "@/contexts/OficinaContext";

const TOUR_KEY_PREFIX = "mechanic_tour_completed_";

export function useGuidedTour() {
  const { oficinaAtual } = useOficina();
  const tourKey = `${TOUR_KEY_PREFIX}${oficinaAtual?.id || "global"}`;

  const isTourCompleted = useCallback(() => localStorage.getItem(tourKey) === "true", [tourKey]);
  const markTourCompleted = useCallback(() => localStorage.setItem(tourKey, "true"), [tourKey]);

  const startTour = useCallback(() => {
    // Mark as completed immediately so it never shows again even if user refreshes mid-tour
    markTourCompleted();

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      doneBtnText: "Concluir",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      progressText: "{{current}} de {{total}}",
      popoverClass: "mechanic-tour-popover",
      steps: [
        {
          element: "[data-tour='busca-global']",
          popover: {
            title: "🔍 Busca Unificada",
            description: "Busque por placa, nome do cliente, OS ou orçamento — tudo em um só campo.",
            side: "bottom",
            align: "center",
          },
        },
        {
          element: "[data-tour='menu-clientes']",
          popover: {
            title: "👥 Seus Clientes",
            description: "Todos os clientes ficam salvos aqui com histórico completo de serviços.",
            side: "top",
            align: "start",
          },
        },
        {
          element: "[data-tour='menu-financeiro']",
          popover: {
            title: "💰 Financeiro",
            description: "Veja quanto sua oficina faturou e lucrou. Tudo automático.",
            side: "top",
            align: "center",
          },
        },
        {
          element: "[data-tour='menu-estoque']",
          popover: {
            title: "📦 Estoque",
            description: "Controle suas peças e receba alertas quando estiver acabando.",
            side: "top",
            align: "center",
          },
        },
        {
          popover: {
            title: "➕ Nova OS",
            description: "Use o botão azul '+' na barra inferior para criar uma Ordem de Serviço rápida ou completa.",
            side: "top",
            align: "center",
          },
        },
        {
          popover: {
            title: "🎉 Tudo pronto!",
            description: "Comece cadastrando um cliente, depois um veículo e crie sua primeira OS. O checklist no dashboard te guia!",
          },
        },
      ],
    });

    setTimeout(() => driverObj.drive(), 500);
  }, []);

  const shouldShowTour = useCallback(() => !isTourCompleted(), [isTourCompleted]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(tourKey);
  }, [tourKey]);

  return { startTour, shouldShowTour, resetTour, isTourCompleted };
}
