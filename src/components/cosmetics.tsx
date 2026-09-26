import clsx from "clsx";
import { useMutation, useQuery } from "convex/react";
import { motion, useReducedMotionConfig } from "motion/react";
import { Sparkles, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type ArtSlot, COSMETIC_SLOTS, COSMETICS, cosmeticByKey, type CosmeticSlot, EMOJI_VARIANTS, type Look } from "../../convex/lib/cosmetics";
import { RemoteArt } from "@/components/RemoteArt";
import { Room } from "@/components/room";
import { Avatar } from "@/components/ui";
import { confetti } from "@/world/life";
import { Npc } from "@/world/Npc";

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
      className={clsx(round ? "rounded-full" : "", className)}
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
export function LookCard({ memberId, today, children }: { memberId: Id<"members">; today: string; children?: ReactNode }) {
  const mine = useQuery(api.cosmetics.mine, { today });
  const profile = useQuery(api.cosmetics.profile, mine ? { memberId } : "skip");
  const wear = useMutation(api.cosmetics.wear);
  if (!mine || !profile) return null;
  const banner = mine.look.banner ? cosmeticByKey(mine.look.banner) : undefined;
  const owned = COSMETICS.filter((c) => mine.owned.includes(c.key));
  return (
    <Room title="Your look" subtitle="Your hedgehog in the world, and what teammates see next to your name.">
      {children && <div className="mb-5 border-b border-parchment-deep pb-5">{children}</div>}
      <div>
        <div className="pixel-chip relative overflow-hidden">
          {banner ? <Art art={banner.art} className="h-20 w-full" /> : <div className="h-20 w-full bg-parchment-deep/50" />}
          <div className="relative -mt-8 flex items-end gap-3 px-4 pb-3">
            <FramedAvatar name={profile.name} src={profile.avatarUrl} size={56} look={mine.look} />
            {/* The name overlaps the banner: a crisp 1 px parchment halo keeps it readable over busy art like the Keyboard garden. */}
            <div className="min-w-0 pb-1 [text-shadow:1px_0_0_var(--color-parchment),-1px_0_0_var(--color-parchment),0_1px_0_var(--color-parchment),0_-1px_0_var(--color-parchment)]">
              <div className="truncate font-display text-lg font-semibold text-ink">{profile.name}</div>
              <div className="text-xs text-ink/75">
                {profile.level !== null && (
                  <>
                    Level {profile.level} <span className="text-soil">{profile.title}</span>,{" "}
                  </>
                )}
                {profile.given} given
              </div>
            </div>
          </div>
        </div>

        {owned.length === 0 ? (
          <p className="mt-4 text-sm text-ink/75">
            Frames, banners and hoggie stickers are at the{" "}
            <Link to="/store" className="font-semibold text-ember-deep underline decoration-2 underline-offset-4">
              store stall
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
                  <span className="w-16 text-xs text-ink/75">{SLOT_NAMES[slot]}</span>
                  {choices.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={mine.look[slot] === c.key}
                      aria-label={`Wear ${c.name}`}
                      onClick={() => void wear({ slot, key: c.key })}
                      className={clsx(
                        "pixel-chip flex items-center gap-2 px-2.5 py-1.5 text-sm",
                        mine.look[slot] === c.key ? "bg-lantern text-ink" : "bg-parchment text-ink/75 hover:bg-parchment-deep/60",
                      )}
                    >
                      <Art art={c.art} round={slot !== "banner"} className={slot === "banner" ? "h-4 w-7" : "h-4 w-4"} />
                      {c.name}
                    </button>
                  ))}
                  {mine.look[slot] && (
                    <button type="button" aria-label={`Take off your ${slot}`} onClick={() => void wear({ slot, key: null })} className="text-xs text-ink/70 hover:text-ink/75">
                      Take off
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 border-t border-parchment-deep pt-3">
          <div className="text-xs text-ink/75">Your kudos emoji in Slack</div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {mine.emoji.map((e) => (
              <li key={e.shortcode} className="pixel-chip bg-parchment px-2 py-1 tabular text-xs text-ink" title={e.name}>
                {e.shortcode}
              </li>
            ))}
          </ul>
          {mine.emoji.length > 1 && <p className="mt-1.5 text-xs text-ink/70">Your variants give like the kudos emoji. Only you can give with them.</p>}
        </div>

        {mine.superKudos && (
          <div className="pixel-chip mt-3 flex items-start gap-2.5 bg-lantern/15 px-3.5 py-3 text-sm">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-soil" aria-hidden />
            <div>
              <div className="font-medium text-ink">
                {mine.superKudos.left} of {mine.superKudos.perMonth} Super kudos left this month
              </div>
              <p className="mt-0.5 text-xs text-ink/75">
                Use <span className="tabular text-ink">{mine.superKudos.shortcode}</span> for one person, with a note of 12 words or more. Not the same person twice in a quarter.
                {mine.superKudos.spotlight && " Spotlight features it in the announcement channel."}
              </p>
            </div>
          </div>
        )}
      </div>
    </Room>
  );
}

/** Palette-pixel confetti across the top of a celebration: it bursts from the middle once and comes to rest. */
function Confetti({ count = 24 }: { count?: number }) {
  const still = useReducedMotionConfig();
  return (
    <div data-confetti aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20">
      {confetti(count).map((p, i) => (
        <motion.span
          key={i}
          data-piece
          className="absolute block"
          style={{ width: p.size, height: p.size, backgroundColor: p.color, boxShadow: "1px 1px 0 0 var(--color-dusk-deep)" }}
          initial={still ? false : { left: "50%", top: 0, opacity: 0 }}
          animate={{ left: `${p.x}%`, top: p.y, opacity: 1 }}
          transition={{ duration: 0.5, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/**
 * The receiver's Super kudos celebration (§G7, #134): a pixel window over the world, shown once
 * until they close it, with the hoggie hugging a heart in its frame and a short burst of
 * palette-pixel confetti that settles and stays still. Nothing while the game is off or hidden.
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-dusk-deep/70 p-4">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="super-kudos-title"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className="pixel-frame flex w-full max-w-md flex-col"
      >
        <header className="flex items-center justify-between gap-4 bg-bark px-4 py-3 text-cream">
          <h2 id="super-kudos-title" className="min-w-0 font-display text-xl font-medium leading-7">
            A Super kudos from {celebration.from}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="pixel-chip grid h-8 w-8 shrink-0 place-items-center bg-parchment text-ink hover:bg-lantern focus-visible:outline-lantern"
          >
            <X className="h-4 w-4" strokeWidth={3} aria-hidden />
          </button>
        </header>
        <div className="relative px-6 pb-6 pt-8 text-center">
          <Confetti />
          <div className="relative flex items-end justify-center gap-3">
            <Avatar name={celebration.from} src={celebration.avatarUrl} size={64} ring="ring-4 ring-lantern" />
            <Npc slot="super-kudos-celebration" size={72} />
          </div>
          <p className="relative mt-4 text-sm text-ink/75">Each Herald only has one or two a month, and they chose you.</p>
          {celebration.note && (
            <blockquote data-user-text className="relative mt-4 bg-parchment-deep/50 px-4 py-3 text-left text-sm italic text-ink">
              {celebration.note}
            </blockquote>
          )}
        </div>
      </motion.div>
    </div>
  );
}
