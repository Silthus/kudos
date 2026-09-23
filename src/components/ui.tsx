import clsx from "clsx";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus, X } from "lucide-react";
import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { RARITY_META, type Rarity } from "@/lib/rarity";
import { nf } from "@/lib/format";

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-line bg-panel/80 backdrop-blur-sm shadow-[0_1px_0_0_rgb(255_236_210/0.04)_inset,0_20px_50px_-30px_rgb(0_0_0/0.8)]",
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
    <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-cream">
          {icon}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("font-mono text-[11px] uppercase tracking-[0.14em] text-faint", className)}>{children}</div>;
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "ghost" | "outline" | "danger"; size?: "sm" | "md" | "lg" };

export function Button({ variant = "outline", size = "md", className, children, ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" && "bg-saffron text-ink hover:bg-[#ffc14d] shadow-[0_8px_30px_-10px_var(--color-saffron)]",
        variant === "outline" && "border border-line-strong bg-panel-2 text-cream hover:bg-panel-3",
        variant === "ghost" && "text-muted hover:bg-panel-2 hover:text-cream",
        variant === "danger" && "border border-down/30 bg-down/10 text-down hover:bg-down/20",
        className,
      )}
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
      className="relative inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-ink/60 p-1 [scrollbar-width:none]"
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
            "relative shrink-0 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "text-ink" : "text-muted hover:text-cream",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join("")}`}
              className="absolute inset-0 rounded-lg bg-cream"
              transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
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
      className={clsx("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-semibold text-ink", ring)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 85% 72%), hsl(${(hue + 40) % 360} 70% 55%))`,
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
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-mono uppercase tracking-[0.12em] ring-1 ring-inset",
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        meta.ring,
        meta.bg,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
      <span className={rarity === "legendary" ? "legendary-text font-semibold" : meta.text}>{meta.label}</span>
    </span>
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
  return <span className={clsx("font-display font-semibold tracking-tight tabular", className)}>{typeof value === "number" ? nf.format(value) : value}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-panel-2", className)} />;
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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-[40px] sm:leading-[1.05]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-2">{action}</div>}
    </div>
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
        className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-saffron" : "bg-panel-3")}
      >
        <motion.span
          layout
          transition={{ type: "spring", bounce: 0.3, duration: 0.35 }}
          className={clsx("absolute top-1 h-4 w-4 rounded-full bg-cream shadow", checked ? "right-1" : "left-1")}
        />
      </button>
    </label>
  );
}

export const inputCls = "h-10 w-full rounded-xl border border-line-strong bg-ink/60 px-3 text-sm text-cream outline-none transition focus:border-saffron/60 disabled:opacity-60";

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
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
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
      onClose={() => open && onClose()}
      onCancel={(e) => {
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
        "m-auto max-h-[calc(100dvh-24px)] w-[min(560px,calc(100vw-24px))] overflow-visible bg-transparent p-0 text-cream backdrop:bg-ink/75 backdrop:backdrop-blur-sm",
        className,
      )}
    >
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
          className="flex max-h-[calc(100dvh-24px)] flex-col rounded-2xl border border-line-strong bg-panel shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
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
