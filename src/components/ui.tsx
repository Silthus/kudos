/**
 * The design-system primitives: PostHog's product idiom (Lemon UI) on the tokens in src/index.css.
 * Pages build on these; see CONTEXT.md "Design system" for the vocabulary and the rules.
 */
import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { useEffect, useId, useRef, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { nf } from "@/lib/format";

/** A flat surface: 1px border, 10px radius, no shadow or blur. */
export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section className={clsx("rounded-window border border-border bg-surface", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-4 pt-4 pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-text">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-text-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** A small label above a title or number: sentence case, semibold, text-3. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("text-xs font-semibold text-text-3", className)}>{children}</div>;
}

/**
 * - `primary` / `secondary`: Lemon 3D buttons (face, 1px border, 3px frame; hover lifts, press sinks).
 * - `tertiary`: flat, for low-emphasis actions in toolbars and rows.
 * - `cta`: posthog.com's orange call to action, for the public pages (Landing, Setup) only.
 * - `danger`: destructive, 3D.
 */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "cta" | "danger";
type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" };

const RAISED: Record<Exclude<ButtonVariant, "tertiary">, string> = {
  primary: "btn-3d btn-primary",
  secondary: "btn-3d btn-secondary",
  cta: "btn-3d btn-cta",
  danger: "btn-3d btn-danger",
};

export function Button({ variant = "secondary", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60",
        variant === "tertiary"
          ? "rounded-lemon text-text-2 transition-colors hover:bg-text/[0.075] hover:text-text active:bg-text/[0.05]"
          : RAISED[variant],
        size === "sm" && "h-7 px-2.5 text-[13px]",
        size === "md" && "h-8 px-3 text-sm",
        size === "lg" && "h-10 px-4 text-[15px]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Lemon segmented control: the selected option is raised on a 2px border-bold shadow. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  size?: "sm" | "md";
  /** Accessible name for the group, when no visible label names it. */
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
    // Scrolls sideways instead of widening the page when the tabs don't fit a phone.
    <motion.div
      ref={listRef}
      layoutScroll
      role="tablist"
      aria-label={label}
      className="relative inline-flex max-w-full overflow-x-auto rounded-lemon border border-border-bold bg-surface-2 p-0.5 [scrollbar-width:none]"
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
            "relative shrink-0 whitespace-nowrap rounded-[5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]",
            value === o.value ? "text-text" : "text-text-2 hover:text-text",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join("")}`}
              className="absolute inset-0 rounded-[5px] border border-border-bold bg-surface shadow-[0_2px_0_var(--k-border-bold)]"
              transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            />
          )}
          <span className="relative flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </motion.div>
  );
}

const AVATAR_HUES = [28, 12, 160, 200, 262, 330, 45, 180, 290, 95];
function hueFor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function Avatar({ name, src, size = 36, ring }: { name: string; src?: string | null; size?: number; ring?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-sans font-bold text-on-fill", ring)}
      // A pastel from the name, light enough for on-fill ink in both themes.
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hueFor(name)} 70% 78%)` }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

/** The rarity's shape: ring, dot, diamond, sparkle, star. Decorative: the word always sits next to it. */
export function RarityPip({ rarity, size = 8 }: { rarity: Rarity; size?: number }) {
  const { color, pip } = RARITY_META[rarity];
  if (pip === "ring" || pip === "dot") {
    return (
      <span
        data-pip={pip}
        aria-hidden
        className="inline-block shrink-0 rounded-full"
        style={{ width: size, height: size, border: `1.5px solid ${color}`, background: pip === "dot" ? color : "transparent" }}
      />
    );
  }
  if (pip === "diamond") {
    return <span data-pip={pip} aria-hidden className="inline-block shrink-0 rotate-45 rounded-[1px]" style={{ width: size - 1, height: size - 1, background: color }} />;
  }
  const star = pip === "star";
  return (
    <svg data-pip={pip} width={size + 3} height={size + 3} viewBox="0 0 12 12" className="shrink-0" aria-hidden>
      <path
        d={star ? "M6 .5l1.6 3.6 3.9.4-2.9 2.6.8 3.9L6 9 2.6 11l.8-3.9L.5 4.5l3.9-.4z" : "M6 0l1.6 4.4L12 6 7.6 7.6 6 12 4.4 7.6 0 6l4.4-1.6z"}
        fill={color}
      />
    </svg>
  );
}

/** A tinted chip with ink text, the pip and the word. */
export function RarityBadge({ rarity, size = "sm" }: { rarity: Rarity; size?: "xs" | "sm" }) {
  const { color, label } = RARITY_META[rarity];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lemon border font-semibold text-text",
        size === "xs" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs",
      )}
      style={{ borderColor: `color-mix(in oklab, ${color} 45%, var(--k-border))`, background: `color-mix(in oklab, ${color} 10%, var(--k-surface))` }}
    >
      <RarityPip rarity={rarity} />
      {label}
    </span>
  );
}

export function Trend({ cur, prev, suffix = "vs prev.", compact }: { cur: number; prev: number | null | undefined; suffix?: string; compact?: boolean }) {
  if (prev === null || prev === undefined) return null;
  const diff = cur - prev;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const pctText = prev > 0 ? `${diff >= 0 ? "+" : ""}${Math.round((diff / prev) * 100)}%` : diff > 0 ? `+${diff}` : "±0";
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-semibold tabular", diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-text-2")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pctText}
      {!compact && <span className="font-normal text-text-3">{suffix}</span>}
    </span>
  );
}

export function Progress({ value, max, color = "var(--k-accent)", className, height = 6 }: { value: number; max: number; color?: string; className?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={clsx("w-full overflow-hidden rounded-full bg-surface-3", className)} style={{ height }} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function BigNumber({ value, className }: { value: number | string; className?: string }) {
  return <span className={clsx("font-display font-extrabold tracking-tight tabular", className)}>{typeof value === "number" ? nf.format(value) : value}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-lemon bg-surface-3", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-3xl text-text-3">{icon}</div>}
      <p className="font-display text-base font-bold text-text">{title}</p>
      {children && <p className="max-w-sm text-sm text-text-2">{children}</p>}
    </div>
  );
}

/** The scene header under the breadcrumb bar: eyebrow, Nunito title, subtitle, actions on the right. */
export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-text-2">{subtitle}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** posthog.com's pop-in: a slight overshoot over 200 ms, ending on a still frame. */
const POP_EASE = [0.34, 1.56, 0.64, 1] as const;

/**
 * posthog.com window chrome, for moments only: dialogs, discovery reveals, celebrations, stamps, the mobile
 * More sheet. A slim title bar (optionally tinted, e.g. by rarity or status) and an optional close button.
 * Pages themselves stay flat Cards.
 */
export function Window({
  title,
  icon,
  tint,
  onClose,
  titleId,
  pop = true,
  className,
  children,
  ...rest
}: {
  title: ReactNode;
  icon?: ReactNode;
  /** A colour (token var) that tints the title bar. */
  tint?: string;
  onClose?: () => void;
  /** Id for the title, so a dialog can point aria-labelledby at it. */
  titleId?: string;
  /** Pop in on mount. Off when a parent animates the window (e.g. a drawer sliding in). */
  pop?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof motion.section>, "title" | "children">) {
  const barStyle: CSSProperties = tint
    ? { background: `color-mix(in oklab, ${tint} 16%, var(--k-surface-2))`, borderBottomColor: `color-mix(in oklab, ${tint} 40%, var(--k-border-bold))` }
    : {};
  return (
    <motion.section
      initial={pop ? { opacity: 0, scale: 0.92 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: POP_EASE }}
      className={clsx("flex flex-col overflow-hidden rounded-window border border-border-bold bg-surface shadow-window", className)}
      {...rest}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border-bold bg-surface-2 py-1 pr-1 pl-3" style={barStyle}>
        {icon && <span className="shrink-0 text-text-2">{icon}</span>}
        <h2 id={titleId} className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
          {title}
        </h2>
        {onClose && (
          <button onClick={onClose} className="rounded-lemon p-1 text-text-3 hover:bg-text/10 hover:text-text" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>
      {children}
    </motion.section>
  );
}

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
        <span className="block text-sm font-semibold text-text">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-text-2">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-50",
          checked ? "border-accent bg-accent" : "border-border-bold bg-surface-3",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          className={clsx("absolute top-0.5 h-3.5 w-3.5 rounded-full border border-border-bold bg-surface", checked ? "right-0.5" : "left-0.5")}
        />
      </button>
    </label>
  );
}

/** Text inputs, selects and textareas (add a height override for textareas). */
export const inputCls =
  "h-8 w-full rounded-lemon border border-border-bold bg-surface px-2.5 text-sm text-text outline-none transition-colors placeholder:text-text-3 hover:border-text-3 focus:border-accent disabled:opacity-60";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="text-sm font-semibold text-text">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-text-2">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

/** A modal on Window chrome, built on the native <dialog>: focus trapping, Escape and the top layer come for free. */
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
  /** "drawer" slides in from the right edge at full height, for side panels like a ledger. */
  variant?: "modal" | "drawer";
}) {
  const drawer = variant === "drawer";
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Only a press that both starts and ends on the backdrop closes: a text selection
  // dragged out of an input must not throw the draft away.
  const pressedBackdrop = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal focuses the first control (the close button); honour an explicit start field.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close(); // restores focus to whatever opened it
  }, [open]);
  useEffect(() => () => ref.current?.close(), []);
  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {subtitle && <p className="-mt-1 mb-3 text-[13px] text-text-2">{subtitle}</p>}
        {children}
      </div>
      {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2 px-4 py-3">{footer}</footer>}
    </>
  );
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
        "overflow-visible bg-transparent p-0 text-text backdrop:bg-[var(--k-scrim)]",
        // max-w-full overrides the UA's `max-width: calc(100% - 6px - 2em)` on modal dialogs.
        drawer ? "my-0 ml-auto mr-0 h-dvh max-h-dvh w-[min(460px,100vw)] max-w-full" : "m-auto max-h-[calc(100dvh-24px)] w-[min(560px,calc(100vw-24px))]",
        className,
      )}
    >
      {open &&
        (drawer ? (
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }} className="h-dvh">
            <Window title={title} titleId={titleId} onClose={onClose} pop={false} className="h-full rounded-none border-y-0 border-r-0">
              {body}
            </Window>
          </motion.div>
        ) : (
          <Window title={title} titleId={titleId} onClose={onClose} className="max-h-[calc(100dvh-24px)]">
            {body}
          </Window>
        ))}
    </dialog>
  );
}
