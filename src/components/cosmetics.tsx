import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { motion } from "motion/react";
import { Palette, Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type ArtSlot, COSMETIC_SLOTS, COSMETICS, cosmeticByKey, type CosmeticSlot, EMOJI_VARIANTS, type Look } from "../../convex/lib/cosmetics";
import { RemoteArt } from "@/components/RemoteArt";
import { Avatar, Card, CardHeader } from "@/components/ui";

/**
 * Cosmetics (#98, #55 §G5, §G12): avatar frames, banners, hoggie stickers and kudos-emoji variants.
 *
 * Every piece of art is an **art slot** (§G17): `lib/art.ts` maps a slot to PostHog's art (#101),
 * loaded from PostHog's servers at runtime, never committed while the repo is public. Slots without
 * PostHog art, and any art that can't load, show a placeholder in the slot's colours.
 */

const gradient = (colors: string[]) => `linear-gradient(135deg, ${colors.join(", ")})`;

/** One art slot: its PostHog art over the placeholder in its colours. Hoggies are shown whole, scenes fill the slot. */
export function Art({ art, className, round }: { art: ArtSlot; className?: string; round?: boolean }) {
  return (
    <RemoteArt
      slot={art.slot}
      fit={art.slot.startsWith("hoggie-") ? "contain" : "cover"}
      className={clsx(round ? "rounded-full" : "rounded-xl", className)}
      fallback={<span data-placeholder className="absolute inset-0" style={{ background: gradient(art.colors) }} />}
    />
  );
}

/** A member's picture in their frame, with their hoggie sticker at its corner. */
export function FramedAvatar({ name, src, size = 36, look = {} }: { name: string; src?: string | null; size?: number; look?: Look }) {
  const frame = look.frame ? cosmeticByKey(look.frame) : undefined;
  const sticker = look.sticker ? cosmeticByKey(look.sticker) : undefined;
  // The frame shows as a ring around the picture, a thin dark gap between them so it reads at any size.
  const ring = frame ? Math.max(3, Math.round(size / 10)) : 0; // no frame, no room for one
  const gap = Math.max(1, Math.round(ring / 3));
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size + ring * 2, height: size + ring * 2 }} data-frame={frame?.key} data-sticker={sticker?.key}>
      {frame && <Art art={frame.art} round className="absolute inset-0" />}
      <span className="relative rounded-full" style={{ boxShadow: frame ? `0 0 0 ${gap}px var(--color-ink)` : undefined }}>
        <Avatar name={name} src={src} size={size} />
      </span>
      {sticker && (
        // A sticker is a third of the picture, never smaller than a readable dot.
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-[var(--color-ink)]" style={{ width: Math.max(10, size / 3), height: Math.max(10, size / 3) }}>
          <Art art={sticker.art} round className="h-full w-full" />
          <span className="sr-only">{sticker.name}</span>
        </span>
      )}
    </span>
  );
}

/** Whether an item is a cosmetic or an emoji variant, with art to preview. */
export function hasItemArt(itemKey: string): boolean {
  return cosmeticByKey(itemKey) !== undefined || EMOJI_VARIANTS.some((v) => v.item === itemKey);
}

/** The Store's preview of a cosmetic or an emoji variant; nothing for other items. */
export function ItemArt({ itemKey }: { itemKey: string }) {
  const cosmetic = cosmeticByKey(itemKey);
  const variant = EMOJI_VARIANTS.find((v) => v.item === itemKey);
  const art = cosmetic?.art ?? variant?.art;
  if (!art) return null;
  const shape = cosmetic?.slot === "banner" ? "h-14 w-24" : "h-14 w-14";
  return <Art art={art} round={cosmetic?.slot === "frame" || !!variant} className={shape} />;
}

const SLOT_NAMES: Record<CosmeticSlot, string> = { frame: "Frame", banner: "Banner", sticker: "Sticker" };

/**
 * Your look on Me: your profile as teammates see it (level, title, kudos given, never a rank), what
 * you wear and the rest of what you own to switch to, the kudos emoji you can give with, and your
 * Super kudos this month. Nothing while the game is off or hidden.
 */
export function LookCard({ memberId, today }: { memberId: Id<"members">; today: string }) {
  const mine = useQuery(api.cosmetics.mine, { today });
  const profile = useQuery(api.cosmetics.profile, mine ? { memberId } : "skip");
  const wear = useMutation(api.cosmetics.wear);
  if (!mine || !profile) return null;
  const banner = mine.look.banner ? cosmeticByKey(mine.look.banner) : undefined;
  const owned = COSMETICS.filter((c) => mine.owned.includes(c.key));
  return (
    <Card>
      <CardHeader title="Your look" subtitle="What teammates see next to your name." icon={<Palette className="h-4 w-4 text-saffron" />} />
      <div className="px-5 pb-5">
        <div className="relative overflow-hidden rounded-2xl border border-line">
          {banner ? <Art art={banner.art} className="h-20 w-full rounded-none" /> : <div className="h-20 w-full bg-panel-2" />}
          <div className="relative -mt-8 flex items-end gap-3 px-4 pb-3">
            <FramedAvatar name={profile.name} src={profile.avatarUrl} size={56} look={mine.look} />
            {/* The name overlaps the banner: a shadow keeps it readable over busy art like the Keyboard garden. */}
            <div className="min-w-0 pb-1 [text-shadow:0_1px_2px_rgb(0_0_0/0.95),0_0_8px_rgb(0_0_0/0.8)]">
              <div className="truncate font-display text-lg font-semibold text-cream">{profile.name}</div>
              <div className="text-xs text-muted">
                {profile.level !== null && (
                  <>
                    Level {profile.level} · <span className="text-saffron">{profile.title}</span> ·{" "}
                  </>
                )}
                {profile.given} given
              </div>
            </div>
          </div>
        </div>

        {owned.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Frames, banners and hoggie stickers are in the{" "}
            <Link to="/store" className="text-saffron hover:underline">
              Store
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {COSMETIC_SLOTS.map((slot) => {
              const choices = owned.filter((c) => c.slot === slot);
              if (choices.length === 0) return null;
              return (
                <div key={slot} className="flex flex-wrap items-center gap-2">
                  <span className="w-16 text-xs text-muted">{SLOT_NAMES[slot]}</span>
                  {choices.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={mine.look[slot] === c.key}
                      aria-label={`Wear ${c.name}`}
                      onClick={() => void wear({ slot, key: c.key })}
                      className={clsx(
                        "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition",
                        mine.look[slot] === c.key ? "border-saffron/60 bg-saffron/10 text-cream" : "border-line text-muted hover:border-line-strong",
                      )}
                    >
                      <Art art={c.art} round={slot !== "banner"} className={slot === "banner" ? "h-4 w-7" : "h-4 w-4"} />
                      {c.name}
                    </button>
                  ))}
                  {mine.look[slot] && (
                    <button type="button" aria-label={`Take off your ${slot}`} onClick={() => void wear({ slot, key: null })} className="text-xs text-faint hover:text-muted">
                      Take off
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 border-t border-line pt-3">
          <div className="text-xs text-muted">Your kudos emoji in Slack</div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {mine.emoji.map((e) => (
              <li key={e.shortcode} className="rounded-lg border border-line px-2 py-1 font-mono text-xs text-cream" title={e.name}>
                {e.shortcode}
              </li>
            ))}
          </ul>
          {mine.emoji.length > 1 && <p className="mt-1.5 text-xs text-faint">Your variants give like the kudos emoji. Only you can give with them.</p>}
        </div>

        {mine.superKudos && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-saffron/40 bg-saffron/5 px-3.5 py-3 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-saffron" aria-hidden />
            <div>
              <div className="font-medium text-cream">
                {mine.superKudos.left} of {mine.superKudos.perMonth} Super kudos left this month
              </div>
              <p className="mt-0.5 text-xs text-muted">
                Use <span className="font-mono text-cream">{mine.superKudos.shortcode}</span> for one person, with a note of 12 words or more. Not the same person twice in a quarter.
                {mine.superKudos.spotlight && " Spotlight features it in the announcement channel."}
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * The receiver's Super kudos celebration (§G7): shown once, over whatever page they open, until
 * they close it. Nothing while the game is off or hidden from them.
 */
export function SuperKudosCelebration({ today }: { today: string }) {
  const celebration = useQuery(api.superKudos.celebration, { today });
  const seen = useMutation(api.superKudos.seen);
  const closeRef = useRef<HTMLButtonElement>(null);
  const id = celebration?.id;
  // Like a dialog: it takes focus when it opens, and Escape closes it.
  useEffect(() => {
    if (!id) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && void seen({ id });
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, seen]);
  if (!celebration) return null;
  const close = () => void seen({ id: celebration.id });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="super-kudos-title"
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-saffron/50 bg-panel p-6 text-center shadow-2xl"
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-24 opacity-60" style={{ background: gradient(["#fde68a", "#f7a501", "#f54e00"]) }} />
        <button ref={closeRef} type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-muted hover:bg-panel-2 hover:text-cream">
          <X className="h-4 w-4" />
        </button>
        <div className="relative mt-8 flex justify-center">
          <span className="relative">
            <Avatar name={celebration.from} src={celebration.avatarUrl} size={64} ring="ring-4 ring-saffron" />
            {/* A hoggie hugging a heart beside the giver, outside the flow so the picture stays centred with or without it. */}
            <RemoteArt slot="super-kudos-celebration" fit="contain" className="absolute bottom-[-6px] left-full ml-1 h-20 w-20" />
          </span>
        </div>
        <h2 id="super-kudos-title" className="relative mt-4 font-display text-2xl font-semibold text-cream">
          A Super kudos from {celebration.from}
        </h2>
        <p className="mt-1 text-sm text-muted">Each Herald only has one or two a month, and they chose you.</p>
        {celebration.note && <blockquote className="mt-4 rounded-2xl bg-panel-2 px-4 py-3 text-left text-sm italic text-cream">{celebration.note}</blockquote>}
      </motion.div>
    </div>
  );
}
