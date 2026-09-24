import clsx from "clsx";
import { useState, type CSSProperties, type ReactNode } from "react";
import { artFor } from "@/lib/art";

type Status = "loading" | "loaded" | "fallback";

/**
 * One art slot with PostHog art (#101): the slot's `fallback` fills the box, and the remote image
 * (from `lib/art.ts`) fades in over it once it has loaded. If it fails, or the slot has no PostHog
 * art, the fallback is all there is. The image is lazy, async-decoded and sized, and the box keeps
 * its own size (`className`/`style`), so nothing shifts while it loads. Decorative: `aria-hidden`.
 */
export function RemoteArt({
  slot,
  fallback,
  className,
  style,
  fit = "cover",
}: {
  slot: string;
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
  fit?: "cover" | "contain";
}) {
  const art = artFor(slot);
  // Keyed by slot, so switching to another slot loads afresh even after a failure.
  const [state, setState] = useState<{ slot: string; status: Status }>({ slot, status: "loading" });
  const status: Status = !art ? "fallback" : state.slot === slot ? state.status : "loading";
  const settle = (next: Status) => setState({ slot, status: next });
  return (
    <span data-art-slot={slot} data-art={status} aria-hidden className={clsx("relative block overflow-hidden", className)} style={style}>
      {fallback}
      {art && status !== "fallback" && (
        <img
          key={slot}
          src={art.src}
          width={art.width}
          height={art.height}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          // A cached image can finish before React listens: pick that up when the element mounts.
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0 && status === "loading") settle("loaded");
          }}
          onLoad={() => settle("loaded")}
          onError={() => settle("fallback")}
          className={clsx(
            "absolute inset-0 h-full w-full transition-opacity duration-300",
            fit === "cover" ? "object-cover" : "object-contain",
            status === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
