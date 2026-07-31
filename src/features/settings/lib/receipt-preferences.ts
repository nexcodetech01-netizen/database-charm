/**
 * Preferências do Cupom Não Fiscal.
 * Armazenamento local por empresa. Sem alteração de banco/services.
 */

export interface ReceiptPreferences {
  showLogo: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showWhatsapp: boolean;
  showSeller: boolean;
  showCustomer: boolean;
  showQrCode: boolean;
  showSocial: boolean;
  farewell: string;
}

export const DEFAULT_RECEIPT_PREFERENCES: ReceiptPreferences = {
  showLogo: true,
  showAddress: true,
  showPhone: true,
  showWhatsapp: true,
  showSeller: true,
  showCustomer: true,
  showQrCode: false,
  showSocial: true,
  farewell: "Obrigado pela preferência!\nVolte sempre.",
};

const KEY = (companyId: string) => `nexos:receipt-prefs:${companyId}`;

export function getReceiptPreferences(companyId: string): ReceiptPreferences {
  if (typeof window === "undefined") return DEFAULT_RECEIPT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY(companyId));
    if (!raw) return DEFAULT_RECEIPT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<ReceiptPreferences>;
    return { ...DEFAULT_RECEIPT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_RECEIPT_PREFERENCES;
  }
}

export function saveReceiptPreferences(
  companyId: string,
  prefs: ReceiptPreferences,
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY(companyId), JSON.stringify(prefs));
}
