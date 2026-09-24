import clsx from "clsx";
import { motion } from "motion/react";
import { Ellipsis, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router";
import { mobileNav, navGroups, type NavBadge as Badge, type NavGroup, type NavItem } from "../lib/nav";

/** A count on a nav entry (open store requests on Admin, or whatever More hides). */
function NavBadge({ badge, className }: { badge: Badge; className?: string }) {
  return (
    <span
      data-nav-badge
      title={badge.label}
      className={clsx("grid h-[18px] min-w-[18px] place-items-center rounded-full bg-saffron px-1 font-mono text-[10px] font-semibold leading-none text-ink", className)}
    >
      <span aria-hidden>{badge.count > 99 ? "99+" : badge.count}</span>
      <span className="sr-only">{badge.label}</span>
    </span>
  );
}

const groupLabelCls = "px-3 font-mono text-[10px] uppercase tracking-wider text-faint";

/** Desktop: every page, under You / Team / Workspace. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const id = useId();
  return (
    // Scrolls on short screens; the padding keeps focus outlines clear of the scroll clip.
    <nav aria-label="Main navigation" className="-mx-2 mt-5 flex min-h-0 flex-col gap-5 overflow-y-auto px-2 py-1">
      {navGroups(items).map((g) => (
        // Groups, not headings: the sidebar comes before the page's own h1.
        <div key={g.id} role="group" aria-labelledby={`${id}-${g.id}`}>
          <div id={`${id}-${g.id}`} className={clsx(groupLabelCls, "pb-1.5")}>
            {g.label}
          </div>
          <div className="flex flex-col gap-1">
            {g.items.map((n) => (
              <NavLink
                key={n.id}
                to={n.to}
                className={({ isActive }) =>
                  clsx(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "text-cream" : "text-muted hover:bg-panel/70 hover:text-cream",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-line-strong bg-panel-2" transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />
                    )}
                    <n.icon className={clsx("relative h-4 w-4", isActive && "text-saffron")} />
                    <span className="relative">{n.label}</span>
                    {n.badge && <NavBadge badge={n.badge} className="relative ml-auto" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

const tabCls = "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium";

/** Icon over label; the badge sits on the icon's corner but follows the label, so it's read as "Admin, 5 open…". */
function TabFace({ icon: Icon, label, badge }: { icon: NavItem["icon"]; label: string; badge?: Badge }) {
  return (
    <>
      <Icon className="h-4 w-4" />
      <span className="max-w-full truncate">{label}</span>
      {badge && <NavBadge badge={badge} className="absolute left-[calc(50%+2px)] top-0" />}
    </>
  );
}

/** Mobile: four tabs and a More sheet; the page you're on is always one of the tabs. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const { tabs, more, moreBadge } = mobileNav(items, pathname);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const picked = useRef(false);
  const sheetId = useId();
  const close = useCallback(() => setOpen(false), []);
  const pick = useCallback(() => (picked.current = true), []);
  // Once the sheet is gone: a page picked from it hands focus to that page's tab, anything else back to More.
  const restoreFocus = useCallback(() => (picked.current ? navRef.current?.querySelector<HTMLElement>("[aria-current='page']") : moreRef.current)?.focus(), []);

  // Arriving on a page (from the sheet, or Back) puts the sheet away.
  useEffect(close, [pathname, close]);

  return (
    <>
      <nav ref={navRef} aria-label="Main navigation" className="fixed inset-x-3 bottom-3 z-30 flex justify-around gap-0.5 rounded-2xl border border-line-strong bg-panel/90 p-1.5 backdrop-blur-xl lg:hidden">
        {tabs.map((n) => (
          <NavLink key={n.id} to={n.to} className={({ isActive }) => clsx(tabCls, isActive ? "bg-panel-3 text-saffron" : "text-faint")}>
            <TabFace icon={n.icon} label={n.short} badge={n.badge} />
          </NavLink>
        ))}
        {more.length > 0 && (
          <button
            ref={moreRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls={open ? sheetId : undefined}
            onClick={() => {
              picked.current = false;
              setOpen((o) => !o);
            }}
            className={clsx(tabCls, open ? "bg-panel-3 text-cream" : "text-faint")}
          >
            <TabFace icon={Ellipsis} label="More" badge={moreBadge} />
          </button>
        )}
      </nav>
      {open && <MoreSheet id={sheetId} groups={more} onClose={close} onPick={pick} restoreFocus={restoreFocus} />}
    </>
  );
}

const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * A modal bottom sheet, portalled to <body> so everything else can go inert: focus moves in and
 * stays in, Escape, the close button or the backdrop put it away. Picking a page doesn't close it
 * directly; the route change does, so focus can then find the new page's tab.
 */
function MoreSheet({ id, groups, onClose, onPick, restoreFocus }: { id: string; groups: NavGroup[]; onClose: () => void; onPick: () => void; restoreFocus: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const sheet = ref.current!;
    const host = hostRef.current!;
    // Screen-reader swipes and browse mode ignore a Tab trap; inert takes the page away from them too.
    const background = [...document.body.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.contains(host) && !el.inert);
    background.forEach((el) => (el.inert = true));
    sheet.querySelector<HTMLElement>("a[href]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const inside = sheet.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    // The sheet is mobile-only: growing past the breakpoint hides it, so it must not keep the page locked.
    const desktop = window.matchMedia?.("(min-width: 1024px)");
    const onDesktop = (e: MediaQueryListEvent) => e.matches && onClose();
    document.addEventListener("keydown", onKey);
    desktop?.addEventListener("change", onDesktop);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      desktop?.removeEventListener("change", onDesktop);
      document.body.style.overflow = overflow;
      background.forEach((el) => (el.inert = false));
      restoreFocus();
    };
  }, [onClose, restoreFocus]);

  return createPortal(
    <div ref={hostRef} className="fixed inset-0 z-40 lg:hidden">
      <motion.div
        data-sheet-backdrop
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 bg-ink/75 backdrop-blur-sm"
      />
      <motion.div
        ref={ref}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
        className="absolute inset-x-3 bottom-3 max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-line-strong bg-panel pb-2 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)]"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 id={titleId} className="font-display text-lg font-semibold tracking-tight">
            More
          </h2>
          <button type="button" onClick={onClose} className="-mr-2 rounded-lg p-3 text-faint hover:bg-panel-2 hover:text-cream" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex flex-col gap-4 px-2 pt-3">
          {groups.map((g) => (
            <div key={g.id}>
              <h3 className={clsx(groupLabelCls, "pb-1")}>{g.label}</h3>
              {/* Never the current page: that one is always a tab. */}
              {g.items.map((n) => (
                <NavLink key={n.id} to={n.to} onClick={onPick} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted hover:bg-panel-2 hover:text-cream">
                  <n.icon className="h-4 w-4 text-faint" />
                  <span>{n.label}</span>
                  {n.badge && <NavBadge badge={n.badge} className="ml-auto" />}
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
