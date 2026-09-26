import { motion, useReducedMotionConfig } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

/** How long the coins take to reach your wallet. */
export const COINS_TO_WALLET_MS = 900;

/**
 * Coins flying from something a window did to the Hog coins in the HUD's corner: a few gold pixels,
 * once, then gone; nothing under reduced motion. Picked garden fruit hops up off its button (#129);
 * coins claimed at the offering stone drop from the canopy first (`arc: "drop"`, #157). The world's own
 * hop off the hedgehog is `Life.tsx`'s, for coins that come without a window.
 */
export function CoinsToWallet({ from, count, onDone, arc = "hop" }: { from: HTMLElement; count: number; onDone: () => void; arc?: "hop" | "drop" }) {
  const still = useReducedMotionConfig();
  const layer = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<{ x: number; y: number; dx: number; dy: number; fall: number } | null>(null);
  useLayoutEffect(() => {
    // Measured against the layer itself: inside a window, `fixed` may be relative to the window.
    const origin = layer.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const a = from.getBoundingClientRect();
    const start = { x: a.left + a.width / 2, y: a.top };
    const coinsAt = document.querySelector("[data-hud-coins]")?.getBoundingClientRect();
    const end = coinsAt && coinsAt.width > 0 ? { x: coinsAt.left + 8, y: coinsAt.top + 8 } : { x: start.x, y: -24 };
    setPath({ x: start.x - origin.left, y: start.y - origin.top, dx: end.x - start.x, dy: end.y - start.y, fall: arc === "drop" ? a.height : -32 });
    const timer = setTimeout(onDone, COINS_TO_WALLET_MS + count * 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);
  if (still) return null;
  return (
    <div ref={layer} aria-hidden className="pointer-events-none fixed left-0 top-0 z-50 h-0 w-0">
      {path &&
        Array.from({ length: count }, (_, i) => (
          <motion.span
            key={i}
            data-coin-flight
            className="absolute h-2 w-2 bg-lantern shadow-[2px_2px_0_var(--color-dusk-deep)]"
            style={{ left: path.x + (i - (count - 1) / 2) * 10, top: path.y }}
            initial={{ x: 0, y: 0 }}
            animate={{ x: [0, 0, path.dx - (i - (count - 1) / 2) * 10], y: [0, path.fall, path.dy] }}
            transition={{ duration: COINS_TO_WALLET_MS / 1000, delay: i * 0.06, ease: "easeOut", times: [0, arc === "drop" ? 0.45 : 0.35, 1] }}
          />
        ))}
    </div>
  );
}
