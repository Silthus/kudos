// PROTOTYPE (#54): celebration primitives for the PostHog restyle.
// Rule (PostHog motion): animate in, ease out, end on a still frame. Nothing loops. Reduced motion = no movement, same final frame.
import clsx from "clsx";
import { motion } from "motion/react";
import { Check, Gift, Heart, Lock, Sparkles, Star, Truck } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { celebrate } from "@/lib/hedgehog";
import { RarityBadge, RarityPip, Window } from "./ui";

const POP = [0.34, 1.56, 0.64, 1] as const; // ease-out-back, PostHog's window pop-in

/**
 * A bot reply. When it is a new discovery the entrance escalates with rarity:
 * common slides in · uncommon presses in like a 3D button · rare opens as a tinted window ·
 * epic adds a crest-style rarity stamp and a hog cameo · legendary adds the gradient bar, a party hog and its name in a flash.
 */
export function DiscoveryMoment({ rarity, text, isNew, to, category }: { rarity: Rarity; text: ReactNode; isNew: boolean; to: string; category: string }) {
  const meta = RARITY_META[rarity];
  const tier = ["common", "uncommon", "rare", "epic", "legendary"].indexOf(rarity);
  useEffect(() => {
    if (isNew && tier >= 3) celebrate(rarity, rarity === "legendary" ? ["Legendary", "find!"] : ["Epic", "find!"]);
  }, [isNew, rarity, tier]);

  const body = (
    <div className="p-3">
      <div className="mb-1 text-[11px] font-semibold text-text-3">
        {to} · {category}
      </div>
      <p className="text-[14px] leading-relaxed">{text}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <RarityBadge rarity={rarity} size="xs" />
        {isNew && <span className="text-xs font-semibold text-link">New discovery</span>}
      </div>
    </div>
  );

  if (!isNew || tier < 2) {
    return (
      <motion.div
        initial={tier === 1 && isNew ? { y: -3, boxShadow: "0 6px 0 var(--k-border-bold)" } : { opacity: 0, y: -8 }}
        animate={tier === 1 && isNew ? { y: 0, boxShadow: "0 3px 0 var(--k-border-bold)" } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="rounded-[var(--radius-window)] border border-border bg-surface"
        style={isNew ? { borderColor: `color-mix(in oklab, ${meta.color} 45%, var(--k-border))` } : undefined}
      >
        {body}
      </motion.div>
    );
  }

  return (
    <div className="relative" data-hog-platform>
      <Window
        title={`${meta.label} discovery`}
        icon={<RarityPip rarity={rarity} size={9} />}
        tint={meta.color}
        className={clsx(rarity === "legendary" && "border-[color-mix(in_oklab,var(--k-r-legendary)_55%,var(--k-border-bold))]")}
      >
        {rarity === "legendary" && <div className="h-1 bg-[linear-gradient(90deg,var(--k-r-legendary),#f7a501)]" />}
        {body}
      </Window>
      {tier >= 3 && (
        <motion.div
          initial={{ scale: 1.8, rotate: -18, opacity: 0 }}
          animate={{ scale: 1, rotate: -8, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3, ease: POP }}
          className="absolute -right-2 -top-3"
        >
          <Crest tint={meta.color} glyph={rarity === "legendary" ? "star" : "sparkles"} size={44} />
        </motion.div>
      )}
    </div>
  );
}

const GLYPHS = { star: Star, sparkles: Sparkles, heart: Heart, gift: Gift, check: Check, truck: Truck } as const;

/**
 * Our own heraldry (no hedgehog, not traced from PostHog's crests): a heater shield, a tinctured field,
 * a chevron in a lighter tint and one charge glyph. `locked` renders the debossed outline used for unearned crests.
 */
export function Crest({ tint, glyph, size = 56, locked, title }: { tint: string; glyph: keyof typeof GLYPHS; size?: number; locked?: boolean; title?: string }) {
  const G = locked ? Lock : GLYPHS[glyph];
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size * 1.15 }} title={title}>
      <svg viewBox="0 0 40 46" width={size} height={size * 1.15} className="absolute inset-0" aria-hidden>
        <path
          d="M3 3h34v17c0 12-8 19-17 23C11 39 3 32 3 20z"
          fill={locked ? "transparent" : tint}
          stroke={locked ? "var(--k-border-bold)" : "color-mix(in oklab, black 45%, " + tint + ")"}
          strokeWidth={2}
          strokeDasharray={locked ? "3 2.5" : undefined}
        />
        {!locked && <path d="M3 25l17-10 17 10v5L20 20 3 30z" fill="color-mix(in oklab, white 35%, transparent)" />}
      </svg>
      <G className="relative -mt-1" style={{ width: size * 0.36, height: size * 0.36, color: locked ? "var(--k-text-3)" : "white" }} strokeWidth={2.5} />
    </span>
  );
}

/** The stamp moment: a crest thunks down (scale 1.6 → 1, slight rotate), with a caption that is ours, never baked into art. */
export function CrestStamp({ tint, glyph, caption, sub }: { tint: string; glyph: keyof typeof GLYPHS; caption: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <motion.div initial={{ scale: 1.6, rotate: -14, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }} transition={{ duration: 0.32, ease: POP }}>
        <Crest tint={tint} glyph={glyph} size={52} />
      </motion.div>
      <div>
        <div className="font-display text-lg font-extrabold leading-tight">{caption}</div>
        {sub && <div className="text-xs text-text-2">{sub}</div>}
      </div>
    </div>
  );
}
