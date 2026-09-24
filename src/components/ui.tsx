import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { RARITY_META, RARITY_ORDER, type Rarity } from "@/lib/rarity";
import { nf } from "@/lib/format";

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={clsx(
        "rounded-[var(--radius-window)] border border-border bg-surface",
        className,
      )}
      {...rest}
    >
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

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("text-xs font-semibold text-text-3", className)}>{children}</div>;
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "tertiary" | "cta" | "ghost" | "outline" | "danger"; size?: "sm" | "md" | "lg" };

const BUTTON_VARS = {
  primary: { "--frame": "var(--k-btn-primary-frame)", "--border-hover": "var(--k-btn-primary-border-hover)", background: "var(--k-btn-primary-face)", borderColor: "var(--k-btn-primary-border)", color: "var(--k-btn-primary-text)" },
  secondary: { "--frame": "var(--k-btn-secondary-frame)", "--border-hover": "var(--k-btn-secondary-border-hover)", background: "var(--k-btn-secondary-face)", borderColor: "var(--k-btn-secondary-border)", color: "var(--k-text)" },
  cta: { "--frame": "var(--k-cta-shell)", "--border-hover": "var(--k-cta-border)", background: "var(--k-cta-face)", borderColor: "var(--k-cta-border)", color: "#111" },
  danger: { "--frame": "color-mix(in oklab, var(--k-danger) 45%, var(--k-surface))", "--border-hover": "var(--k-danger)", background: "var(--k-surface)", borderColor: "color-mix(in oklab, var(--k-danger) 60%, var(--k-surface))", color: "var(--k-danger)" },
} as Record<string, React.CSSProperties>;

/** Lemon-style buttons: primary/secondary/cta/danger sit on a 3D frame; tertiary is flat. */
export function Button({ variant = "secondary", size = "md", className, children, style, ...rest }: ButtonProps) {
  const v = variant === "outline" ? "secondary" : variant === "ghost" ? "tertiary" : variant;
  const raised = v !== "tertiary";
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60",
        raised ? "btn-3d" : "rounded-[var(--radius-lemon)] text-text-2 hover:bg-text/[0.075] hover:text-text active:bg-text/[0.05]",
        size === "sm" && "h-7 px-2.5 text-[13px]",
        size === "md" && "h-8 px-3 text-sm",
        size === "lg" && "h-10 px-4 text-[15px]",
        className,
      )}
      style={{ ...(raised ? BUTTON_VARS[v] : {}), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[];
  size?: "sm" | "md";
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
      className="relative inline-flex max-w-full overflow-x-auto rounded-[var(--radius-lemon)] border border-border-bold bg-surface-2 p-0.5 [scrollbar-width:none]"
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
  const hue = hueFor(name);
  return (
    <span
      className={clsx("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-sans font-bold text-[#111]", ring)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue} 70% 78%)`,
      }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );
}

export function RarityBadge({ rarity, size = "sm" }: { rarity: Rarity; size?: "xs" | "sm" }) {
  const meta = RARITY_META[rarity];
  return (
    <span
      className={clsx("inline-flex items-center gap-1.5 rounded-[var(--radius-lemon)] border font-semibold text-text", size === "xs" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs")}
      style={{ borderColor: `color-mix(in oklab, ${meta.color} 45%, var(--k-border))`, background: `color-mix(in oklab, ${meta.color} 10%, var(--k-surface))` }}
    >
      <RarityPip rarity={rarity} />
      {meta.label}
    </span>
  );
}

/** Rarity is never colour alone: the pip's shape grows with the tier (dot, diamond, star-ish) and the word is always shown. */
export function RarityPip({ rarity, size = 8 }: { rarity: Rarity; size?: number }) {
  const color = RARITY_META[rarity].color;
  const tier = RARITY_ORDER.indexOf(rarity);
  if (tier <= 1) return <span className="inline-block rounded-full" style={{ width: size, height: size, background: tier === 0 ? "transparent" : color, border: `1.5px solid ${color}` }} />;
  if (tier === 2) return <span className="inline-block rotate-45 rounded-[1px]" style={{ width: size - 1, height: size - 1, background: color }} />;
  return (
    <svg width={size + 3} height={size + 3} viewBox="0 0 12 12" aria-hidden>
      <path d="M6 0l1.6 4.2L12 6l-4.4 1.8L6 12 4.4 7.8 0 6l4.4-1.8z" fill={color} />
    </svg>
  );
}

export function Trend({ cur, prev, suffix = "vs prev.", compact }: { cur: number; prev: number | null | undefined; suffix?: string; compact?: boolean }) {
  if (prev === null || prev === undefined) return null;
  const diff = cur - prev;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const pctText = prev > 0 ? `${diff >= 0 ? "+" : ""}${Math.round((diff / prev) * 100)}%` : diff > 0 ? `+${diff}` : "±0";
  return (
    <span className={clsx("inline-flex items-center gap-1 text-xs font-medium tabular", diff > 0 ? "text-up" : diff < 0 ? "text-down" : "text-muted")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pctText}
      {!compact && <span className="font-normal text-faint">{suffix}</span>}
    </span>
  );
}

export function Progress({ value, max, color = "var(--color-saffron)", className, height = 6 }: { value: number; max: number; color?: string; className?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={clsx("w-full overflow-hidden rounded-full bg-panel-3", className)} style={{ height }} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function BigNumber({ value, className }: { value: number | string; className?: string }) {
  return <span className={clsx("font-display font-extrabold tracking-tight tabular", className)}>{typeof value === "number" ? nf.format(value) : value}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-[var(--radius-lemon)] bg-surface-3", className)} />;
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
      {icon && <div className="text-3xl">{icon}</div>}
      <p className="font-display text-base font-semibold text-cream">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold text-text-3">{eyebrow}</div>}
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-text-2">{subtitle}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Window chrome (posthog.com idiom) for moments, dialogs and celebrations: slim title bar, pop-in on an
 * ease-out-back spring, still final frame. `tint` colours the title bar (rarity, status).
 */
export function Window({ title, tint, onClose, children, className, pop = true, icon }: { title: ReactNode; tint?: string; onClose?: () => void; children: ReactNode; className?: string; pop?: boolean; icon?: ReactNode }) {
  return (
    <motion.section
      initial={pop ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
      className={clsx("overflow-hidden rounded-[var(--radius-window)] border border-border-bold bg-surface", className)}
      style={{ boxShadow: "var(--k-shadow-window)" }}
    >
      <header
        className="flex items-center gap-2 border-b border-border-bold px-2 py-1 text-[13px] font-semibold"
        style={tint ? { background: `color-mix(in oklab, ${tint} 16%, var(--k-surface-2))`, borderBottomColor: `color-mix(in oklab, ${tint} 40%, var(--k-border-bold))` } : { background: "var(--k-surface-2)" }}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {onClose && (
          <button onClick={onClose} className="rounded p-0.5 text-text-3 hover:bg-text/10 hover:text-text" aria-label="Close">
            <X className="h-3.5 w-3.5" />
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
        <span className="block text-sm font-medium text-cream">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-accent" : "bg-border-bold")}
      >
        <motion.span
          layout
          transition={{ type: "spring", bounce: 0.3, duration: 0.35 }}
          className={clsx("absolute top-1 h-4 w-4 rounded-full bg-white shadow", checked ? "right-1" : "left-1")}
        />
      </button>
    </label>
  );
}

export const inputCls = "h-8 w-full rounded-[var(--radius-lemon)] border border-border-bold bg-surface px-2.5 text-sm text-text outline-none transition hover:border-text-3 focus:border-accent disabled:opacity-60";

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

/** A modal built on the native <dialog>: focus trapping, Escape and the top layer come for free. */
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
        "overflow-visible bg-transparent p-0 text-cream backdrop:bg-ink/75 backdrop:backdrop-blur-sm",
        // max-w-full overrides the UA's `max-width: calc(100% - 6px - 2em)` on modal dialogs.
        drawer ? "my-0 ml-auto mr-0 h-dvh max-h-dvh w-[min(460px,100vw)] max-w-full" : "m-auto max-h-[calc(100dvh-24px)] w-[min(560px,calc(100vw-24px))]",
        className,
      )}
    >
      {open && (
        <motion.div
          initial={drawer ? { opacity: 0, x: 40 } : { opacity: 0, y: 12, scale: 0.97 }}
          animate={drawer ? { opacity: 1, x: 0 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", bounce: drawer ? 0 : 0.2, duration: drawer ? 0.35 : 0.4 }}
          className={clsx(
            "flex flex-col border-line-strong bg-panel shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]",
            drawer ? "h-dvh border-l" : "max-h-[calc(100dvh-24px)] rounded-2xl border",
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-faint hover:bg-panel-2 hover:text-cream" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </motion.div>
      )}
    </dialog>
  );
}
