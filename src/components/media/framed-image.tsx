import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import type { CSSProperties, ImgHTMLAttributes } from "react";

export interface Framing {
  focal_x?: number | null; // 0..100 (object-position X)
  focal_y?: number | null; // 0..100 (object-position Y)
  zoom?: number | null; // >=1 (transform scale)
}

interface FramedImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "className"> {
  src?: string | null;
  alt?: string;
  framing?: Framing | null;
  /** Container aspect ratio. Defaults to 1:1 square. */
  aspect?: "square" | "portrait" | "landscape" | "video";
  /** Container radius. Defaults to `rounded-lg`. */
  rounded?: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
  containerClassName?: string;
  imgClassName?: string;
  fallback?: React.ReactNode;
}

const ASPECT_CLASS: Record<NonNullable<FramedImageProps["aspect"]>, string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  landscape: "aspect-[16/10]",
  video: "aspect-video",
};

const RADIUS_CLASS: Record<NonNullable<FramedImageProps["rounded"]>, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
};

/**
 * Renders a product image in a fixed-aspect (default 1:1) rounded container,
 * applying the saved framing (focal position + zoom) with `object-cover`
 * so the same crop appears everywhere in the app.
 */
export function FramedImage({
  src,
  alt = "",
  framing,
  aspect = "square",
  rounded = "lg",
  containerClassName,
  imgClassName,
  fallback,
  ...imgProps
}: FramedImageProps) {
  const fx = clamp(framing?.focal_x ?? 50, 0, 100);
  const fy = clamp(framing?.focal_y ?? 50, 0, 100);
  const zoom = clamp(framing?.zoom ?? 1, 1, 10);

  const style: CSSProperties = {
    objectPosition: `${fx}% ${fy}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${fx}% ${fy}%`,
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-muted",
        ASPECT_CLASS[aspect],
        RADIUS_CLASS[rounded],
        containerClassName,
      )}
    >
      {src ? (
        <img
          {...imgProps}
          src={src}
          alt={alt}
          className={cn(
            "absolute inset-0 h-full w-full object-cover",
            imgClassName,
          )}
          style={style}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-muted-foreground">
          {fallback ?? <ImageIcon className="h-8 w-8" />}
        </div>
      )}
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
