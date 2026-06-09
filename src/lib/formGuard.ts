/**
 * BLINDAGEM: Proteção contra submissão acidental por Enter no mobile.
 * 
 * Problema: No teclado virtual mobile, o botão "Enter"/"Go"/"Next" dispara
 * o evento submit do formulário, causando recarregamento da página e perda
 * de todos os dados digitados.
 * 
 * Solução: Interceptar Enter em inputs (exceto textarea/submit) e mover
 * o foco para o próximo campo. Submissão só acontece pelo botão "Salvar".
 */

import React from "react";

function isVisibleElement(element: HTMLElement) {
  return !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null;
}

/**
 * Handler para onKeyDown do <form> que bloqueia Enter de submeter sem intenção.
 * Ele avança para o próximo campo relevante e, no último campo, dispara o submit.
 * 
 * Uso: <form onKeyDown={handleFormKeyDown} onSubmit={handleSubmit}>
 */
export function handleFormKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter" || (e.nativeEvent as KeyboardEvent).isComposing) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  const tagName = target.tagName.toLowerCase();
  const inputType = tagName === "input" ? (target as HTMLInputElement).type : "";

  // Permitir Enter em textarea (nova linha), botões e controles especiais
  if (tagName === "textarea" || tagName === "button" || target.getAttribute("role") === "combobox") {
    return;
  }

  // Inputs que não devem participar da navegação por Enter
  if (["submit", "button", "checkbox", "radio", "file"].includes(inputType)) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const form = e.currentTarget;
  const focusableSelectors = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button[type="submit"]:not([disabled])',
    'button[data-enter-focusable="true"]:not([disabled])',
  ].join(", ");

  const focusableElements = Array.from(form.querySelectorAll(focusableSelectors))
    .filter((element) => isVisibleElement(element as HTMLElement)) as HTMLElement[];

  const currentIndex = focusableElements.indexOf(target);
  const nextElement = currentIndex >= 0 ? focusableElements[currentIndex + 1] : null;

  if (nextElement) {
    nextElement.focus();

    if (nextElement instanceof HTMLInputElement && !["date", "time", "number"].includes(nextElement.type)) {
      nextElement.select();
    }
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])') as HTMLButtonElement | HTMLInputElement | null;

  if (submitButton) {
    form.requestSubmit(submitButton);
    return;
  }

  form.requestSubmit();
}

/**
 * Salva rascunho do formulário no localStorage.
 * Retorna os dados salvos se existirem.
 */
export function saveFormDraft<T>(key: string, data: T): void {
  try {
    localStorage.setItem(`form_draft_${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage cheio ou indisponível - ignorar silenciosamente
  }
}

export function loadFormDraft<T>(key: string, maxAgeMs = 30 * 60 * 1000): T | null {
  try {
    const raw = localStorage.getItem(`form_draft_${key}`);
    if (!raw) return null;
    
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > maxAgeMs) {
      localStorage.removeItem(`form_draft_${key}`);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export function clearFormDraft(key: string): void {
  try {
    localStorage.removeItem(`form_draft_${key}`);
  } catch {
    // ignorar
  }
}
