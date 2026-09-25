import clsx from "clsx";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { useEffect, useId, useRef, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { nf } from "@/lib/format";

/**
 * The pixel UI kit (#126, #127): parchment windows in bark frames on a dusk sky. Square corners,
 * hard pixel steps for depth, Pixelify Sans for titles and numbers, Nunito for reading. Colours
 * inherit where they can: inside a frame text is ink, on dusk or bark it's cream.
 */

/** A pixel-framed parchment panel. `relative`, so it contains what's absolutely positioned inside. */
export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={clsx("relative pixel-frame", className)} {...rest}>
      {children}
    </section>
  );
}

/**
 * Sideways scroller for a table wider than a phone. It is `relative` so it is the containing block
 * of anything absolutely positioned inside (sr-only headers, badges): otherwise the Card around it
 * (also `relative`) would contain them outside the scroller and widen the page.
 */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="relative overflow-x-auto px-2 pb-3">{children}</div>;
}

/** A panel's title strip: the title in Pixelify over a 1 px parchment-deep rule. */
export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="mx-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-parchment-deep pt-4 pb-3 mb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-xl font-medium leading-7">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink/75">{subtitle}</p>}
      </div>
      {action && <div className="max-w-full shrink-0">{action}</div>}
    </header>
  );
}

/** A small sentence-case label. It takes its surface's text colour, softened. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("text-xs font-semibold opacity-75", className)}>{children}</div>;
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "ghost" | "outline" | "danger"; size?: "sm" | "md" | "lg" };

/** The 3-D pixel button: lantern (primary), parchment (outline), ember (danger); ghost is flat. */
export function Button({ variant = "outline", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex select-none items-center justify-center gap-2 font-semibold disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant !== "ghost" && "pixel-btn",
        variant === "outline" && "pixel-btn-secondary",
        variant === "danger" && "pixel-btn-danger",
        variant === "ghost" && "opacity-80 hover:bg-ink/10 hover:opacity-100",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Pixel tabs: a parchment-deep rail, the chosen tab a bark block with cream text. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  wrap = false,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  size?: "sm" | "md";
  /** Page-level tabs: wrap onto a second row on a phone, so every tab stays in sight. */
  wrap?: boolean;
  /** What the tabs choose, for screen readers when a page has more than one set. */
  label?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  // Keep the selected tab visible when the bar scrolls (deep links like ?tab=slack on a phone).
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const left = tab.offsetLeft; // the list is `relative`, so this is within the scroller
    if (left < list.scrollLeft || left + tab.offsetWidth > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: left - 8, behavior: "smooth" });
    }
  }, [value]);
  return (
    // Scrolls sideways (or wraps) instead of widening the page when the tabs don't fit a phone.
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={clsx(
        "pixel-chip relative inline-flex max-w-full gap-0.5 bg-parchment-deep p-1 text-ink",
        wrap ? "flex-wrap" : "overflow-x-auto [scrollbar-width:none]",
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            "relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold disabled:cursor-not-allowed disabled:opacity-40",
            wrap && "flex-auto", // wrapped rows share the width evenly
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "bg-bark text-cream" : "text-ink/75 hover:bg-parchment hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const AVATAR_HUES = [28, 12, 160, 200, 262, 330, 45, 180, 290, 95];
function hueFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

/** Faces are round, so avatars are the one round thing in the kit. A flat fill, no gradient. */
export function Avatar({ name, src, size = 36, ring }: { name: string; src?: string | null; size?: number; ring?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue = hueFor(name);
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-medium text-ink", ring)}
      style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 70% 68%)` }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

/** A pixel chip: a square swatch in the rarity's colour and its name. Legendary gets the two-colour underline. */
export function RarityBadge({ rarity, size = "sm" }: { rarity: Rarity; size?: "xs" | "sm" }) {
  const meta = RARITY_META[rarity];
  return (
    <span
      className={clsx(
        "pixel-chip inline-flex items-center gap-1.5 bg-parchment font-semibold text-ink",
        size === "xs" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs",
      )}
    >
      <span data-swatch className="h-2 w-2 shrink-0" style={{ background: meta.color }} />
      <span className={clsx(rarity === "legendary" && "legendary-text")}>{meta.label}</span>
    </span>
  );
}

export function Trend({ cur, prev, suffix = "vs prev.", compact }: { cur: number; prev: number | null | undefined; suffix?: string; compact?: boolean }) {
  if (prev === null || prev === undefined) return null;
  const diff = cur - prev;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const pctText = prev > 0 ? `${diff >= 0 ? "+" : ""}${Math.round((diff / prev) * 100)}%` : diff > 0 ? `+${diff}` : "±0";
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-semibold tabular", diff > 0 ? "text-hedge-deep" : diff < 0 ? "text-ember-deep" : "text-ink/75")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pctText}
      {!compact && <span className="font-normal text-ink/70">{suffix}</span>}
    </span>
  );
}

/**
 * How far a meter's fill reaches, for the stylesheet to cut into 4 px blocks: any progress shows
 * at least one block, and anything short of the max stops a block before full.
 */
export function meterFill(value: number, max: number) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (!(pct > 0)) return "0%"; // also NaN
  if (pct >= 100) return "100%";
  return `clamp(4px, ${Math.round(pct * 100) / 100}%, 100% - 4px)`;
}

/** The pixel meter: a stepped bar in 4 px blocks, outlined in bark. */
export function Progress({ value, max, color = "var(--color-lantern)", className, height = 8, label }: { value: number; max: number; color?: string; className?: string; height?: number; label?: string }) {
  return (
    <div className={clsx("pixel-meter w-full", className)} style={{ height }} role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div data-fill style={{ "--fill": meterFill(value, max), background: color } as CSSProperties} />
    </div>
  );
}

export function BigNumber({ value, className }: { value: number | string; className?: string }) {
  return <span className={clsx("font-display font-medium tabular", className)}>{typeof value === "number" ? nf.format(value) : value}</span>;
}

/** A still parchment-deep block where content is on its way. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("bg-parchment-deep/60", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-full max-w-72" />
      <div className="grid grid-cols-2 gap-4 @lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

/** An empty state: a short note that invites the next step. */
export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon && <div className="text-3xl">{icon}</div>}
      <p className="font-display text-lg font-medium">{title}</p>
      {children && <p className="max-w-sm text-sm text-ink/75">{children}</p>}
    </div>
  );
}

/**
 * A page's wooden sign: the title in Pixelify on a bark board. `eyebrow` is still accepted so pages
 * compile, but the sign shows no eyebrow (#126: no eyebrows).
 */
export function PageHeader({ title, subtitle, action }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="pixel-sign mb-7 flex flex-wrap items-end justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-medium leading-9 sm:text-[40px] sm:leading-[48px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-cream/80">{subtitle}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** A square pixel switch: a bark knob that steps across a parchment-deep (off) or lantern (on) track. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={clsx("flex items-start justify-between gap-6 py-3", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-ink/75">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx("pixel-chip relative mt-0.5 h-6 w-11 shrink-0 disabled:opacity-50", checked ? "bg-lantern" : "bg-parchment-deep")}
      >
        <span className={clsx("absolute top-1 h-4 w-4 bg-bark transition-[left] duration-100 ease-[steps(2)]", checked ? "left-6" : "left-1")} />
      </button>
    </label>
  );
}

/** Inputs sit in a 2 px bark inset with a parchment-deep step inside, like a slot cut in the board. */
export const inputCls =
  "h-10 w-full border-2 border-bark bg-parchment px-3 text-sm text-ink shadow-[inset_2px_2px_0_0_var(--color-parchment-deep)] placeholder:text-ink/70 disabled:opacity-60";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-ink/75">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

/**
 * A pixel window on the native <dialog>: a bark title bar with a square close, a parchment face.
 * Focus moves in on open (an explicit `data-autofocus` field, else the close) and back to whatever
 * opened it on close. Escape and the top layer come from the platform.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className,
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** "drawer" docks to the right edge at full height, for side panels like a ledger. */
  variant?: "modal" | "drawer";
}) {
  const drawer = variant === "drawer";
  const still = useReducedMotion();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  // Only a press that both starts and ends on the backdrop closes: a text selection
  // dragged out of an input must not throw the draft away.
  const pressedBackdrop = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog.querySelector<HTMLElement>("[data-close]"))?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
      if (opener.current?.isConnected) opener.current.focus();
    }
  }, [open]);
  useEffect(() => () => ref.current?.close(), []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // A dialog opened from inside this one (e.g. Adjust balance over the ledger) sends its
      // close/cancel events up the React tree; only this dialog's own events close it.
      onClose={(e) => e.target === e.currentTarget && open && onClose()}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => (pressedBackdrop.current = e.target === ref.current)}
      onClick={(e) => {
        // A click on the <dialog> itself (not its content) landed on the backdrop.
        if (pressedBackdrop.current && e.target === ref.current) onClose();
        pressedBackdrop.current = false;
      }}
      className={clsx(
        "overflow-visible bg-transparent p-0 text-ink backdrop:bg-dusk-deep/70",
        // max-w-full overrides the UA's `max-width: calc(100% - 6px - 2em)` on modal dialogs.
        drawer ? "my-0 ml-auto mr-0 h-dvh max-h-dvh w-[min(460px,100vw)] max-w-full" : "m-auto max-h-[calc(100dvh-24px)] w-[min(560px,calc(100vw-24px))]",
        className,
      )}
    >
      {open && (
        <motion.div
          initial={still ? false : drawer ? { opacity: 0, x: 24 } : { opacity: 0, y: 8 }}
          animate={drawer ? { opacity: 1, x: 0 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className={clsx("pixel-frame flex flex-col", drawer ? "h-dvh" : "max-h-[calc(100dvh-24px)]")}
        >
          <header className="flex items-start justify-between gap-4 bg-bark px-4 py-3 text-cream">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-xl font-medium leading-7">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-sm text-cream/80">{subtitle}</p>}
            </div>
            <button
              data-close
              onClick={onClose}
              className="pixel-chip grid h-8 w-8 shrink-0 place-items-center bg-parchment text-ink hover:bg-lantern focus-visible:outline-lantern"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={3} />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-parchment-deep px-5 py-3">{footer}</footer>}
        </motion.div>
      )}
    </dialog>
  );
}

/** The Kudos wordmark: the workspace's emoji on a dusk tile with a lantern rim, and the name. */
export function Logo({ glyph = "🌮" }: { glyph?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-display text-2xl font-medium">
      <span className="grid h-9 w-9 place-items-center bg-dusk text-lg shadow-[inset_0_0_0_2px_var(--color-lantern)]">{glyph}</span>
      kudos
    </span>
  );
}
