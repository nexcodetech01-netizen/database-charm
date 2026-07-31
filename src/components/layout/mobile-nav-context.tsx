import { createContext, useContext, useState, type ReactNode } from "react";

interface MobileNavContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MobileNavContext.Provider
      value={{ open, setOpen, toggle: () => setOpen(!open) }}
    >
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) {
    // Safe fallback: allows Topbar/Sidebar to render outside provider without crashing.
    return { open: false, setOpen: () => {}, toggle: () => {} };
  }
  return ctx;
}
