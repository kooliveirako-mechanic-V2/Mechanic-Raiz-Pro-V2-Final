/**
 * Formatadores centralizados — Mechanic Raiz Pro
 * Usar SEMPRE estas funções ao invés de formatação inline.
 */

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const parseCurrency = (str: string): number => {
  if (!str) return 0;

  const normalized = str.replace(/[^\d,.-]/g, '').trim();
  if (!normalized) return 0;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    const parsed = Number(
      normalized
        .replace(thousandsSeparator, '')
        .replace(decimalSeparator, '.'),
    );

    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (lastComma !== -1) {
    const parsed = Number(normalized.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (lastDot !== -1) {
    const parts = normalized.split('.');

    if (parts.length > 2) {
      const decimalPart = parts.at(-1) ?? '';
      const integerPart = parts.slice(0, -1).join('');
      const candidate = decimalPart.length === 2
        ? `${integerPart}.${decimalPart}`
        : `${integerPart}${decimalPart}`;
      const parsed = Number(candidate);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    const [integerPart, decimalPart = ''] = parts;
    const candidate = decimalPart.length === 3
      ? `${integerPart}${decimalPart}`
      : normalized;
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatPhone = (str: string): string =>
  str.replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4,5})(\d{4})$/, '$1-$2')
    .slice(0, 15);

export const formatPlate = (str: string): string =>
  str.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
