import clsx from "clsx";
import { RemoteArt } from "@/components/RemoteArt";

/**
 * The Hog coin (#55 §G4, §G17): a gold coin with Max on its face. The coin is our own; Max is
 * PostHog's, loaded from PostHog's servers (`lib/art.ts`). Until he loads, and if he can't, the coin
 * shows an embossed H instead. Decorative: the amount next to it carries the meaning.
 */
export function HogCoin({ size = 20, className }: { size?: number; className?: string }) {
  const rim = Math.max(1.5, size / 12);
  return (
    <span
      data-hog-coin
      aria-hidden
      className={clsx("inline-grid shrink-0 place-items-center rounded-full align-middle", className)}
      style={{
        width: size,
        height: size,
        padding: rim,
        background: "radial-gradient(circle at 32% 28%, #fff3c4, #f7a501 48%, #b45309 100%)",
        boxShadow: "0 1px 0 rgb(0 0 0 / 0.35), inset 0 0 0 1px rgb(120 53 15 / 0.55)",
      }}
    >
      <RemoteArt
        slot="coin-max"
        className="h-full w-full rounded-full"
        style={{ background: "radial-gradient(circle at 40% 35%, #fde68a, #f59e0b)", boxShadow: "inset 0 0 0 1px rgb(146 64 14 / 0.5)" }}
        fallback={
          // An embossed H, drawn rather than typed so it never reads into the amount's text.
          <svg data-coin-face viewBox="0 0 20 20" className="h-full w-full" fill="#92400e">
            <rect x="6" y="5.5" width="2.2" height="9" rx="0.6" />
            <rect x="11.8" y="5.5" width="2.2" height="9" rx="0.6" />
            <rect x="7" y="9" width="6" height="2" rx="0.5" />
          </svg>
        }
      />
    </span>
  );
}
