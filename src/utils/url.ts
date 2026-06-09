export function getBaseUrl(): string {
  // BLINDAGEM MÁXIMA: Para dar 100% de certeza ao usuário, forçamos o domínio profissional
  // em qualquer ambiente que não seja o desenvolvimento local (localhost).
  // Isso garante que mesmo no Preview do Lovable, os links gerados serão do domínio oficial.
  
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
    return window.location.origin;
  }

  // Em qualquer outro lugar (Preview ou Produção), usamos obrigatoriamente o domínio comprado.
  return "https://www.mechanicraizpro.com.br";
}

export function getPublicOSLink(idOrNumber: string | number): string {
  return `${getBaseUrl()}/os/${idOrNumber}`;
}

export function getPublicOrcamentoLink(idOrNumber: string | number): string {
  return `${getBaseUrl()}/orcamento/${idOrNumber}`;
}
