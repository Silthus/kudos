import { IconCrown, IconEmoji, IconGear, IconPulse, IconStack } from "@posthog/icons";
import { useEffect, useId, type ComponentType, type ReactNode, type RefObject } from "react";
import { AppLink } from "../AppLink";
import { useCountUp } from "../countUp";
import { prefersReducedMotion } from "../reducedMotion";
import { MemberFace } from "../Face";
import { HedgehogSitting } from "../hoggies";
import type { Album, AlbumLevel } from "./answer";
import { earnedEmojisOf, levelShareOf, plural, xpToNextOf } from "./facts";
import type { Held } from "./PackOpening";
import { hrefOf, type Place } from "./place";
import { TrayPanel } from "./TrayPanel";
import { usePopover, type Popover } from "./usePopover";

export type TrayActions = { busy: boolean; trouble: string | null; putIn: (item: string) => void; putAllIn: () => void };

type TopBarProps = { album: Album; place: Place; wide: boolean; held: Held; moving: boolean; inert: boolean; onOpenPacks: () => void; packsButton: RefObject<HTMLButtonElement | null>; trayButton: RefObject<HTMLButtonElement | null>; tray: TrayActions };

export function TopBar({ album, place, wide, held, moving, inert, onOpenPacks, packsButton, trayButton, tray }: TopBarProps) {
  const popover = usePopover<"tray" | "emojis" | "menu">();
  useTrayOpenOnThePacksPage(place, popover);
  return (
    <header className="al-top" inert={inert}>
      <AppLink href="/" className="al-brand" data-slot="home">
        <HedgehogSitting size={30} />
        <span className="al-brand-word">HedgeHug</span>
      </AppLink>
      <XpBar level={held.level ?? album.level} moving={moving} />
      <div className="al-top-end">
        <PacksButton waiting={album.packs.length} more={album.morePacks} current={place.kind === "packs"} button={packsButton} waitsForPuttingIn={tray.busy} onOpen={onOpenPacks} />
        <TrayButton album={album} items={held.tray ?? album.tray.length} popover={popover} button={trayButton} tray={tray} />
        {wide && <PageLinks place={place} />}
        <EmojiButton earned={earnedEmojisOf(album)} popover={popover} />
        {wide ? <MeAndSettings album={album} place={place} /> : <Menu album={album} place={place} popover={popover} />}
      </div>
    </header>
  );
}

function XpBar({ level: settled, moving }: { level: AlbumLevel; moving: boolean }) {
  const counted = useCountUp(settled.xp);
  const level = moving && !prefersReducedMotion() ? { ...settled, xp: counted } : settled;
  return (
    <div className="al-xp">
      <span className="al-level">Level {level.level}</span>
      <span className="al-xp-track" aria-hidden="true">
        <span className="al-xp-fill" style={{ width: `${Math.max(3, levelShareOf(level) * 100)}%` }} />
      </span>
      <span className="al-xp-words">
        {xpToNextOf(level)} XP to level {level.level + 1}
      </span>
    </div>
  );
}

function useTrayOpenOnThePacksPage(place: Place, popover: Popover<"tray" | "emojis" | "menu">) {
  const onThePacksPage = place.kind === "packs";
  const { show } = popover;
  useEffect(() => {
    if (onThePacksPage) show("tray");
  }, [onThePacksPage, show]);
}

type PacksButtonProps = { waiting: number; more: boolean; current: boolean; button: RefObject<HTMLButtonElement | null>; waitsForPuttingIn: boolean; onOpen: () => void };

function PacksButton({ waiting, more, current, button, waitsForPuttingIn, onOpen }: PacksButtonProps) {
  const count = more ? `${waiting}+` : `${waiting}`;
  return (
    <button type="button" ref={button} onClick={waitsForPuttingIn ? undefined : onOpen} aria-disabled={waitsForPuttingIn || undefined} aria-haspopup="dialog" className="al-packs" data-waiting={waiting > 0 ? "" : undefined} aria-current={current ? "page" : undefined} aria-label={waiting === 0 ? "No packs waiting" : `Open your packs, ${count} waiting`}>
      <span className="al-packs-art" aria-hidden="true">
        <span className="al-packs-wrapper" />
        <span className="al-packs-wrapper" />
        {waiting > 0 && <span className="al-packs-count">{count}</span>}
      </span>
      <span className="al-packs-words" aria-hidden="true">
        <strong>{waiting === 0 ? "No packs" : more ? `${count} packs` : plural(waiting, "pack", "packs")}</strong>
        <span>{waiting === 0 ? "Say thanks to earn one" : "Ready to open"}</span>
      </span>
    </button>
  );
}

type TrayButtonProps = { album: Album; items: number; popover: Popover<"tray" | "emojis" | "menu">; button: RefObject<HTMLButtonElement | null>; tray: TrayActions };

function TrayButton({ album, items, popover, button, tray }: TrayButtonProps) {
  const putting = (send: () => void) => {
    popover.close();
    button.current?.focus();
    send();
  };
  return (
    <PopoverButton
      name="tray"
      popover={popover}
      button={button}
      label={trayLabelOf(items, tray.busy)}
      panelLabel="Tray"
      className="al-tray"
      busy={tray.busy}
      content={<TrayPanel album={album} trouble={tray.trouble} onPutIn={(item) => putting(() => tray.putIn(item))} onPutAllIn={() => putting(tray.putAllIn)} />}
    >
      <IconStack />
      {items > 0 && (
        <span key={items} className="al-tray-count">
          {items}
        </span>
      )}
    </PopoverButton>
  );
}

function trayLabelOf(items: number, busy: boolean) {
  if (busy) return `Tray, putting in, ${items} to go`;
  return items === 0 ? "Tray, nothing to put in" : `Tray, ${items} to put in`;
}

function EmojiButton({ earned, popover }: { earned: number; popover: Popover<"tray" | "emojis" | "menu"> }) {
  return (
    <PopoverButton name="emojis" popover={popover} label={`Your emojis, ${earned} earned`} panelLabel="Your emojis" className="al-emojis" content={<p>{earned === 0 ? "Unlock a team sticker, a milestone or a level to earn your first emoji." : `You've earned ${plural(earned, "emoji", "emojis")}.`}</p>}>
      <IconEmoji />
      <span className="al-emojis-count" aria-hidden="true">
        {earned}
      </span>
    </PopoverButton>
  );
}

type PopoverButtonProps = { name: "tray" | "emojis" | "menu"; popover: Popover<"tray" | "emojis" | "menu">; label: string; panelLabel: string; className: string; content: ReactNode; children: ReactNode; button?: RefObject<HTMLButtonElement | null>; busy?: boolean };

function PopoverButton({ name, popover, label, panelLabel, className, content, children, button, busy = false }: PopoverButtonProps) {
  const panel = useId();
  const open = popover.open === name && !busy;
  return (
    <span className="al-popover-anchor" ref={open ? popover.anchor : undefined}>
      <button type="button" ref={button} className={`al-top-button ${className}`} aria-label={label} aria-expanded={open} aria-controls={open ? panel : undefined} aria-disabled={busy || undefined} onClick={busy ? undefined : () => popover.toggle(name)}>
        {children}
      </button>
      {open && (
        <section id={panel} aria-label={panelLabel} className="al-popover">
          {content}
        </section>
      )}
    </span>
  );
}

type PageLink = { kind: "activity" | "leaderboard"; label: string; Icon: ComponentType };

const pageLinks: PageLink[] = [
  { kind: "activity", label: "Activity", Icon: IconPulse },
  { kind: "leaderboard", label: "Leaderboard", Icon: IconCrown },
];

function PageLinks({ place }: { place: Place }) {
  return (
    <>
      {pageLinks.map(({ kind, label, Icon }) => {
        const current = place.kind === kind;
        return (
          <AppLink key={kind} href={hrefOf({ kind })} className="al-icon-link" aria-current={current ? "page" : undefined} data-labelled={current ? "" : undefined}>
            <Icon />
            <span className="al-icon-label">{label}</span>
          </AppLink>
        );
      })}
    </>
  );
}

function MeAndSettings({ album, place, onFollow }: { album: Album; place: Place; onFollow?: () => void }) {
  return (
    <span className="al-me-group">
      <AppLink href={hrefOf({ kind: "profile" })} className="al-me" aria-label={`Your profile, ${album.me.name}`} aria-current={place.kind === "profile" ? "page" : undefined} onFollow={onFollow}>
        <MemberFace face={album.me.face} className="al-me-face" />
        <span className="al-me-name ph-no-capture">{album.me.name}</span>
      </AppLink>
      <AppLink href={hrefOf({ kind: "settings" })} className="al-cog" aria-label="Settings" aria-current={place.kind === "settings" ? "page" : undefined} onFollow={onFollow}>
        <IconGear />
      </AppLink>
    </span>
  );
}

function Menu({ album, place, popover }: { album: Album; place: Place; popover: Popover<"tray" | "emojis" | "menu"> }) {
  const close = popover.close;
  return (
    <PopoverButton
      name="menu"
      popover={popover}
      label="Menu"
      panelLabel="Menu"
      className="al-menu"
      content={
        <ul className="al-menu-list">
          {pageLinks.map(({ kind, label, Icon }) => (
            <li key={kind}>
              <AppLink href={hrefOf({ kind })} className="al-menu-link" aria-current={place.kind === kind ? "page" : undefined} onFollow={close}>
                <Icon />
                <span>{label}</span>
              </AppLink>
            </li>
          ))}
          <li>
            <MeAndSettings album={album} place={place} onFollow={close} />
          </li>
        </ul>
      }
    >
      <MemberFace face={album.me.face} className="al-me-face" />
    </PopoverButton>
  );
}
