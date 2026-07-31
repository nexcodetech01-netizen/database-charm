import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PRINT_PREFERENCES,
  getPrintPreferences,
  savePrintPreferences,
  type PrintPreferences,
} from "../lib/print-preferences";
import { detectPrinterCapabilities } from "../lib/printer";

export function usePrintPreferences(companyId: string | null | undefined) {
  const [prefs, setPrefs] = useState<PrintPreferences>(
    DEFAULT_PRINT_PREFERENCES,
  );

  useEffect(() => {
    if (!companyId) return;
    setPrefs(getPrintPreferences(companyId));
  }, [companyId]);

  const save = useCallback(
    (next: PrintPreferences) => {
      if (!companyId) return;
      savePrintPreferences(companyId, next);
      setPrefs(getPrintPreferences(companyId));
    },
    [companyId],
  );

  const capabilities = useMemo(
    () =>
      detectPrinterCapabilities(
        typeof navigator === "undefined" ? null : navigator,
        prefs,
      ),
    [prefs],
  );

  return { prefs, save, capabilities };
}
