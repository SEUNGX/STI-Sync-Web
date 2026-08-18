/**
 * Standard Currency Formatter for STI Sync
 * Formats numbers into Philippine Peso currency representation: ₱1,000.00
 */

export interface FormatCurrencyOptions {
  /** Include a '+' sign for positive non-zero values (e.g. +₱1,000.00) */
  showSign?: boolean;
  /** Exclude the '₱' symbol (e.g. 1,000.00) */
  noSymbol?: boolean;
  /** Number of decimal places (defaults to 2) */
  decimals?: number;
}

/**
 * Format a number or numeric string as Philippine Peso currency (₱1,000.00).
 * Handles null, undefined, and NaN gracefully by defaulting to 0.00.
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const { showSign = false, noSymbol = false, decimals = 2 } = options;

  const num = typeof amount === 'number' ? amount : Number(amount);
  const validNum = isNaN(num) ? 0 : num;

  const formattedAbs = Math.abs(validNum).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const symbol = noSymbol ? '' : '₱';

  if (validNum < 0) {
    return `-${symbol}${formattedAbs}`;
  }

  if (showSign && validNum > 0) {
    return `+${symbol}${formattedAbs}`;
  }

  return `${symbol}${formattedAbs}`;
}

/**
 * Alias helper for variance display (e.g. +₱1,000.00 / -₱500.00 / ₱0.00)
 */
export function formatVariance(amount: number | string | null | undefined): string {
  const num = typeof amount === 'number' ? amount : Number(amount);
  const validNum = isNaN(num) ? 0 : num;
  if (validNum > 0) return `+${formatCurrency(validNum)}`;
  if (validNum < 0) return formatCurrency(validNum);
  return formatCurrency(0);
}
