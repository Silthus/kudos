import clsx from "clsx";
import { RemoteArt } from "@/components/RemoteArt";

/**
 * A hoggie inside a window (#134, #126 "Art and licensing"): PostHog's illustrated hoggies never
 * stand on the pixel map; in a window they sit in one consistent pixel frame, a bark rim round a
 * parchment-deep face with a pixel step. The art loads from PostHog's servers (`lib/art.ts`); if it
 * can't, the empty frame stays, so nothing shifts. Decorative.
 */
export function Npc({ slot, size = 72, className }: { slot: string; size?: 56 | 72 | 96; className?: string }) {
  return (
    <span
      data-npc
      aria-hidden
      className={clsx("relative block shrink-0 bg-parchment-deep p-1.5 shadow-[inset_0_0_0_2px_var(--color-bark),2px_2px_0_0_var(--color-dusk-deep)]", className)}
      style={{ width: size, height: size }}
    >
      <RemoteArt slot={slot} fit="contain" className="h-full w-full" fallback={null} />
    </span>
  );
}
