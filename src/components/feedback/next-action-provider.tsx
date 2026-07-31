import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { NextActionDialog, type NextActionPayload } from "./next-action-dialog";

type ShowFn = (payload: NextActionPayload) => void;

const Ctx = createContext<ShowFn | null>(null);

export function NextActionProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<NextActionPayload | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback<ShowFn>((p) => {
    setPayload(p);
    setOpen(true);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {payload && (
        <NextActionDialog
          open={open}
          onOpenChange={setOpen}
          title={payload.title}
          summary={payload.summary}
          question={payload.question}
          primaryAction={payload.primaryAction}
          secondaryActions={payload.secondaryActions}
        />
      )}
    </Ctx.Provider>
  );
}

export function useNextAction(): ShowFn {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNextAction must be used inside NextActionProvider");
  return ctx;
}
