import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_RECEIPT_PREFERENCES,
  ReceiptPreferences,
  getReceiptPreferences,
  saveReceiptPreferences,
} from "../lib/receipt-preferences";

export function useReceiptPreferences(companyId: string | null | undefined) {
  const [prefs, setPrefs] = useState<ReceiptPreferences>(
    DEFAULT_RECEIPT_PREFERENCES,
  );

  useEffect(() => {
    if (!companyId) return;
    setPrefs(getReceiptPreferences(companyId));
  }, [companyId]);

  const save = useCallback(
    (next: ReceiptPreferences) => {
      if (!companyId) return;
      saveReceiptPreferences(companyId, next);
      setPrefs(next);
    },
    [companyId],
  );

  return { prefs, save };
}
