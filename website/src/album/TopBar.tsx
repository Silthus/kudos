import { IconCrown, IconEmoji, IconGear, IconPulse, IconStack } from "@posthog/icons";
import { useEffect, useId, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import { AppLink } from "../AppLink";
import { useCapturing } from "../browserAnalytics/capturing";
import { useCountUp } from "../countUp";
import { prefersReducedMotion } from "../reducedMotion";
import { MemberFace } from "../Face";
import { Feedback } from "../Feedback";
import { HedgehogSitting } from "../hoggies";
import type { Album, AlbumLevel } from "./answer";
import { EmojiPanel } from "./EmojiPanel";
import { earnedEmojisOf, levelShareOf, plural, xpToNextOf } from "./facts";
import type { Held } from "./PackOpening";
import { home, hrefOf, type Place } from "./place";
import { TrayPanel } from "./TrayPanel";
import type { Popover } from "./usePopover";

export type TrayActions = { busy: boolean; trouble: string | null; putIn: (item: string) => void; putAllIn: () => void };

export type TopBarPopups = "tray" | "emojis" | "menu";

type TopBarPopover = Popover<TopBarPopups>;

type TopBarProps = { album: Album; place: Place; wide: boolean; popover: TopBarPopover; justUnlocked: string[]; held: Held; popsTheLevel?: boolean; moving: boolean; inert: boolean; onOpenPacks: () => void; packsButton: RefObject<HTMLButtonElement | null>; trayButton: RefObject<HTMLButtonElement | null>; emojiButton: RefObject<HTMLButtonElement | null>; tray: TrayActions };

export function TopBar({ album, place, wide, popover, justUnlocked, held, popsTheLevel = false, moving, inert, onOpenPacks, packsButton, trayButton, emojiButton, tray }: TopBarProps) {
  useTrayOpenOnThePacksPage(place, popover);
  return (
    <header className="al-top" inert={inert}>
      <AppLink href={hrefOf(home)} className="al-brand" data-slot="home">
        <HedgehogSitting size={30} />
        <span className="al-brand-word">HedgeHug</span>
      </AppLink>
      <XpBar level={held.level ?? album.level} moving={moving} pops={popsTheLevel} />
      <div className="al-top-end">
        {album.board === null && <PacksButton waiting={album.packs.length} more={album.morePacks} current={place.kind === "packs"} button={packsButton} waitsForPuttingIn={tray.busy} onOpen={onOpenPacks} />}
        {album.board === null && <TrayButton album={album} items={held.tray ?? album.tray.length} popover={popover} button={trayButton} tray={tray} />}
        {wide && <PageLinks place={place} />}
        <EmojiButton album={album} popover={popover} button={emojiButton} justUnlocked={justUnlocked} />
        <FeedbackButton />
        {wide ? <MeAndSettings album={album} place={place} /> : <Menu album={album} place={place} popover={popover} />}
      </div>
    </header>
  );
}

function XpBar({ level: settled, moving, pops }: { level: AlbumLevel; moving: boolean; pops: boolean }) {
  const counted = useCountUp(settled.xp);
  const level = moving && !prefersReducedMotion() ? { ...settled, xp: counted } : settled;
  const popped = usePoppedWhenItRises(level.level, pops);
  return (
    <div className="al-xp">
      <span className="al-level" data-popped={popped ? "" : undefined}>
        Level {level.level}
      </span>
      <span className="al-xp-track" aria-hidden="true">
        <span className="al-xp-fill" style={{ width: `${Math.max(3, levelShareOf(level) * 100)}%` }} />
      </span>
      <span className="al-xp-words">
        {xpToNextOf(level)} XP to level {level.level + 1}
      </span>
    </div>
  );
}

const levelPopMs = 1100;

function usePoppedWhenItRises(level: number, pops: boolean) {
  const [popped, setPopped] = useState(false);
  const before = useRef(level);
  useEffect(() => {
    if (pops && level > before.current) setPopped(true);
    before.current = level;
  }, [level, pops]);
  useEffect(() => {
    if (!popped) return;
    const settle = window.setTimeout(() => setPopped(false), levelPopMs);
    return () => window.clearTimeout(settle);
  }, [popped]);
  return popped;
}

function useTrayOpenOnThePacksPage(place: Place, popover: TopBarPopover) {
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
    <button type="button" ref={button} onClick={waitsForPuttingIn ? undefined : onOpen} aria-disabled={waitsForPuttingIn || undefined} aria-haspopup="dialog" className="al-packs" data-waiting={waiting > 0 ? "" : undefined} aria-current={current ? "page" : undefined} data-labelled={current ? "" : undefined} aria-label={waiting === 0 ? "No packs waiting" : `Open your packs, ${count} waiting`}>
      <span className="al-packs-art" aria-hidden="true">
        <span className="al-packs-wrapper" />
        <span className="al-packs-wrapper" />
        {waiting > 0 && <span className="al-packs-count">{count}</span>}
      </span>
      <OpensOut>
        <span className="al-packs-words" aria-hidden="true">
          <strong>{waiting === 0 ? "No packs" : more ? `${count} packs` : plural(waiting, "pack", "packs")}</strong>
          <span>{waiting === 0 ? "Say thanks to earn one" : "Ready to open"}</span>
        </span>
      </OpensOut>
    </button>
  );
}

type TrayButtonProps = { album: Album; items: number; popover: TopBarPopover; button: RefObject<HTMLButtonElement | null>; tray: TrayActions };

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
      <OpensOut>Tray</OpensOut>
    </PopoverButton>
  );
}

function trayLabelOf(items: number, busy: boolean) {
  if (busy) return `Tray, putting in, ${items} to go`;
  return items === 0 ? "Tray, nothing to put in" : `Tray, ${items} to put in`;
}

function EmojiButton({ album, popover, button, justUnlocked }: { album: Album; popover: TopBarPopover; button: RefObject<HTMLButtonElement | null>; justUnlocked: string[] }) {
  const earned = earnedEmojisOf(album);
  return (
    <PopoverButton name="emojis" popover={popover} button={button} label={`Your emojis, ${earned} earned`} panelLabel="Your emojis" className="al-emojis" panelClassName="al-emoji-popover" content={<EmojiPanel album={album} justUnlocked={justUnlocked} onFollow={popover.close} />}>
      <IconEmoji />
      <span className="al-emojis-count" aria-hidden="true">
        {earned}
      </span>
      <OpensOut>Emojis</OpensOut>
    </PopoverButton>
  );
}

type PopoverButtonProps = { name: TopBarPopups; popover: TopBarPopover; label: string; panelLabel: string; className: string; panelClassName?: string; content: ReactNode; children: ReactNode; button?: RefObject<HTMLButtonElement | null>; busy?: boolean };

function PopoverButton({ name, popover, label, panelLabel, className, panelClassName, content, children, button, busy = false }: PopoverButtonProps) {
  const panel = useId();
  const open = popover.open === name && !busy;
  return (
    <span className="al-popover-anchor" ref={open ? popover.anchor : undefined}>
      <button type="button" ref={button} className={`al-top-button ${className}`} aria-label={label} aria-expanded={open} aria-controls={open ? panel : undefined} aria-disabled={busy || undefined} onClick={busy ? undefined : () => popover.toggle(name)}>
        {children}
      </button>
      {open && (
        <section id={panel} aria-label={panelLabel} className={panelClassName === undefined ? "al-popover" : `al-popover ${panelClassName}`}>
          {content}
        </section>
      )}
    </span>
  );
}

function FeedbackButton() {
  const capturer = useCapturing();
  if (capturer === null) return null;
  return <Feedback capturer={capturer} trigger={<button type="button" className="al-top-button" />} label={<OpensOut>Feedback</OpensOut>} />;
}

function OpensOut({ children }: { children: ReactNode }) {
  return (
    <span className="al-opens-out">
      <span>{children}</span>
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
      {pageLinks.map(({ kind, label, Icon }) => (
        <AppLink key={kind} href={hrefOf({ kind })} className="al-icon-link" aria-current={place.kind === kind ? "page" : undefined} data-labelled="">
          <Icon />
          <OpensOut>{label}</OpensOut>
        </AppLink>
      ))}
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

function Menu({ album, place, popover }: { album: Album; place: Place; popover: TopBarPopover }) {
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
