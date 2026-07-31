import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard-key hint chip (visual only). Use to annotate shortcuts like
 * `<Kbd>Enter</Kbd> para salvar`.
 */
export function Kbd({ className, children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
