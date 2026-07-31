import { cn } from "@/lib/utils";

interface NexosLogoProps {
  className?: string;
  /** Pixel size of the logo mark (square). Defaults to 36px. */
  size?: number;
  alt?: string;
}

/**
 * NexOS brand mark — renders the official app icon (N monogram)
 * with soft rounded corners consistent with the PWA icon.
 */
export function NexosLogo({ className, size = 36, alt = "NexOS" }: NexosLogoProps) {
  return (
    <img
      src="/icon-192.png"
      alt={alt}
      width={size}
      height={size}
      className={cn(
        "rounded-[22%] object-cover shadow-sm ring-1 ring-black/5 dark:ring-white/10",
        className,
      )}
      draggable={false}
    />
  );
}
