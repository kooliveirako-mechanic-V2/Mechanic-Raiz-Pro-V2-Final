import { useUserRole } from "./useUserRole";

/**
 * Hook para mascarar dados sensíveis baseado no role do usuário
 * Implementa mascaramento de CPF/CNPJ, chassi, e dados de fornecedor
 */
export function useSecurityMask() {
  const { canViewCustos, isProprietario, isAdministrador } = useUserRole();

  /**
   * Mascara CPF (XXX.XXX.XXX-XX)
   * Mostra apenas os 3 dígitos do meio
   */
  const maskCpf = (cpf: string | null | undefined): string => {
    if (!cpf) return "";
    if (isProprietario || isAdministrador) return cpf;
    
    // Remove caracteres não numéricos
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `***.${digits.slice(3, 6)}.***-**`;
    }
    // Fallback: mostra só últimos 4 dígitos
    return "*".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  };

  /**
   * Mascara CNPJ (XX.XXX.XXX/XXXX-XX)
   * Mostra apenas parte central
   */
  const maskCnpj = (cnpj: string | null | undefined): string => {
    if (!cnpj) return "";
    if (isProprietario || isAdministrador) return cnpj;
    
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length === 14) {
      return `**.${digits.slice(2, 5)}.***/${digits.slice(8, 12)}-**`;
    }
    return "*".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  };

  /**
   * Mascara CPF ou CNPJ automaticamente
   */
  const maskCpfCnpj = (value: string | null | undefined): string => {
    if (!value) return "";
    if (isProprietario || isAdministrador) return value;
    
    const digits = value.replace(/\D/g, "");
    if (digits.length === 11) return maskCpf(value);
    if (digits.length === 14) return maskCnpj(value);
    return "*".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
  };

  /**
   * Mascara número de chassi
   * Mostra apenas os últimos 8 caracteres
   */
  const maskChassi = (chassi: string | null | undefined): string => {
    if (!chassi) return "";
    if (isProprietario || isAdministrador) return chassi;
    
    if (chassi.length > 8) {
      return "*".repeat(chassi.length - 8) + chassi.slice(-8);
    }
    return "*".repeat(chassi.length);
  };

  /**
   * Mascara e-mail
   * Mostra apenas primeira letra e domínio
   */
  const maskEmail = (email: string | null | undefined): string => {
    if (!email) return "";
    if (isProprietario || isAdministrador) return email;
    
    const [local, domain] = email.split("@");
    if (!local || !domain) return "***@***";
    
    return local[0] + "***@" + domain;
  };

  /**
   * Mascara telefone
   * Mostra apenas os últimos 4 dígitos
   */
  const maskPhone = (phone: string | null | undefined): string => {
    if (!phone) return "";
    if (isProprietario || isAdministrador) return phone;
    
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 4) {
      return "(**) *****-" + digits.slice(-4);
    }
    return "***";
  };

  /**
   * Mascara valor monetário (para custos)
   */
  const maskCurrency = (value: number | null | undefined): string | number | null => {
    if (value === null || value === undefined) return null;
    if (canViewCustos) return value;
    return "---";
  };

  /**
   * Verifica se pode ver dados de fornecedor
   */
  const canViewSupplierData = isProprietario || isAdministrador;

  /**
   * Verifica se pode ver dados sensíveis de cliente
   */
  const canViewClientSensitiveData = isProprietario || isAdministrador;

  return {
    maskCpf,
    maskCnpj,
    maskCpfCnpj,
    maskChassi,
    maskEmail,
    maskPhone,
    maskCurrency,
    canViewSupplierData,
    canViewClientSensitiveData,
    // Aliases para compatibilidade
    canViewCosts: canViewCustos,
    isAdmin: isAdministrador,
    isOwner: isProprietario,
  };
}
