import { IconCrown, IconEmoji, IconGear, IconPulse, IconStack } from "@posthog/icons";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode, type RefObject } from "react";
import { AppLink } from "../AppLink";
import { useCapturing } from "../browserAnalytics/capturing";
import { useCountUp } from "../countUp";
import { prefersReducedMotion } from "../reducedMotion";
import { MemberFace } from "../Face";
import { Feedback } from "../Feedback";
import { HedgehogSitting } from "../hoggies";
import type { Album, AlbumLevel, PickKudosEmoji } from "./answer";
import { EmojiPanel } from "./EmojiPanel";
import { usableCountOf } from "./emojiShelf";
import { earnedEmojisOf, levelShareOf, plural, xpToNextOf } from "./facts";
import { NewInThePanelProvider, useNewEmojis } from "./newEmojis";
import type { Held } from "./PackOpening";
import { addressOf, home, hrefOf, myPageOf, type Place } from "./place";
import { PagesBurger } from "./PagesBurger";
import { TrayPanel } from "./TrayPanel";
import type { Popover } from "./usePopover";

export type TrayActions = { busy: boolean; trouble: string | null; putIn: (item: string) => void; putAllIn: () => void };

export type TopBarPopups = "tray" | "emojis" | "menu" | "pages";

type TopBarPopover = Popover<TopBarPopups>;

type TopBarProps = { album: Album; place: Place; wide: boolean; popover: TopBarPopover; justUnlocked: string[]; opensOnJustUnlocked: boolean; held: Held; popsTheLevel?: boolean; moving: boolean; inert: boolean; glow?: ReactNode; onOpenPacks: () => void; packsButton: RefObject<HTMLButtonElement | null>; trayButton: RefObject<HTMLButtonElement | null>; emojiButton: RefObject<HTMLButtonElement | null>; tray: TrayActions; pickKudosEmoji: PickKudosEmoji };

export function TopBar({ album, place, wide, popover, justUnlocked, opensOnJustUnlocked, held, popsTheLevel = false, moving, inert, glow, onOpenPacks, packsButton, trayButton, emojiButton, tray, pickKudosEmoji }: TopBarProps) {
  const trayItems = held.tray ?? album.tray.length;
  const trayShown = album.board === null && (trayItems > 0 || moving || tray.busy);
  useTrayOpenOnThePacksPage(place, popover);
  useTrayPanelClosedWithoutTheTray(trayShown, popover);
  return (
    <header className="al-top" inert={inert}>
      {!wide && <PagesBurger album={album} place={place} popover={popover} />}
      <AppLink href={addressOf(home, myPageOf(album))} className="al-brand" data-slot="home">
        <HedgehogSitting size={30} />
        <span className="al-brand-word">HedgeHug</span>
      </AppLink>
      <XpBar level={held.level ?? album.level} moving={moving} pops={popsTheLevel} glow={glow} />
      <div className="al-top-end">
        {album.board === null && (album.packs.length > 0 || moving) && <PacksButton waiting={album.packs.length} more={album.morePacks} current={place.kind === "packs"} button={packsButton} waitsForPuttingIn={tray.busy} onOpen={onOpenPacks} focusAfter={emojiButton} />}
        {trayShown && <TrayButton album={album} items={trayItems} popover={popover} button={trayButton} tray={tray} focusAfter={emojiButton} />}
        {wide && <PageLinks place={place} />}
        <EmojiButton album={album} popover={popover} button={emojiButton} justUnlocked={justUnlocked} opensOnJustUnlocked={opensOnJustUnlocked} pickKudosEmoji={pickKudosEmoji} />
        <FeedbackButton />
        {wide ? <MeAndSettings album={album} place={place} /> : <Menu album={album} place={place} popover={popover} />}
      </div>
    </header>
  );
}

function XpBar({ level: settled, moving, pops, glow }: { level: AlbumLevel; moving: boolean; pops: boolean; glow: ReactNode }) {
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
      {glow}
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

function useTrayPanelClosedWithoutTheTray(trayShown: boolean, popover: TopBarPopover) {
  const { open, close } = popover;
  useEffect(() => {
    if (!trayShown && open === "tray") close();
  }, [trayShown, open, close]);
}

function useFocusPassedOnWhenItLeaves(button: RefObject<HTMLElement | null>, next: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const leaving = button.current;
    return () => {
      if (leaving !== null && leaving === document.activeElement) next.current?.focus();
    };
  }, [button, next]);
}

type PacksButtonProps = { waiting: number; more: boolean; current: boolean; button: RefObject<HTMLButtonElement | null>; waitsForPuttingIn: boolean; onOpen: () => void; focusAfter: RefObject<HTMLElement | null> };

function PacksButton({ waiting, more, current, button, waitsForPuttingIn, onOpen, focusAfter }: PacksButtonProps) {
  useFocusPassedOnWhenItLeaves(button, focusAfter);
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

type TrayButtonProps = { album: Album; items: number; popover: TopBarPopover; button: RefObject<HTMLButtonElement | null>; tray: TrayActions; focusAfter: RefObject<HTMLElement | null> };

function TrayButton({ album, items, popover, button, tray, focusAfter }: TrayButtonProps) {
  useFocusPassedOnWhenItLeaves(button, focusAfter);
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

type EmojiButtonProps = { album: Album; popover: TopBarPopover; button: RefObject<HTMLButtonElement | null>; justUnlocked: string[]; opensOnJustUnlocked: boolean; pickKudosEmoji: PickKudosEmoji };

function EmojiButton({ album, popover, button, justUnlocked, opensOnJustUnlocked, pickKudosEmoji }: EmojiButtonProps) {
  const { count, label } = emojiCountOf(album);
  const { marked: fresh, inThePanel } = useNewEmojis(album, popover.open === "emojis");
  const newLabel = useId();
  return (
    <PopoverButton name="emojis" popover={popover} button={button} label={label} describedBy={fresh ? newLabel : undefined} labelled panelLabel="Your emojis" className="al-emojis" panelClassName="al-emoji-popover" content={
        <NewInThePanelProvider value={inThePanel}>
          <EmojiPanel album={album} justUnlocked={justUnlocked} opensOnJustUnlocked={opensOnJustUnlocked} onFollow={popover.close} pickKudosEmoji={pickKudosEmoji} />
        </NewInThePanelProvider>
      }>
      <IconEmoji />
      <span className="al-emojis-count" aria-hidden="true">
        {count}
      </span>
      <OpensOut>Emojis</OpensOut>
      {fresh && (
        <span id={newLabel} className="al-emojis-new">
          New
        </span>
      )}
    </PopoverButton>
  );
}

function emojiCountOf(album: Album) {
  if (album.emojiHowTo === undefined) {
    const earned = earnedEmojisOf(album);
    return { count: earned, label: `Your emojis, ${earned} earned` };
  }
  const usable = usableCountOf(album.emojis);
  return { count: usable, label: `Your emojis, ${usable} you can use` };
}

type PopoverButtonProps = { name: TopBarPopups; popover: TopBarPopover; label: string; describedBy?: string; labelled?: boolean; panelLabel: string; className: string; panelClassName?: string; content: ReactNode; children: ReactNode; button?: RefObject<HTMLButtonElement | null>; busy?: boolean };

function PopoverButton({ name, popover, label, describedBy, labelled = false, panelLabel, className, panelClassName, content, children, button, busy = false }: PopoverButtonProps) {
  const panel = useId();
  const open = popover.open === name && !busy;
  return (
    <span className="al-popover-anchor" ref={open ? popover.anchor : undefined}>
      <button type="button" ref={button} className={`al-top-button ${className}`} aria-label={label} aria-describedby={describedBy} data-labelled={labelled ? "" : undefined} aria-expanded={open} aria-controls={open ? panel : undefined} aria-disabled={busy || undefined} onClick={busy ? undefined : () => popover.toggle(name)}>
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
      <AppLink href={addressOf(home, myPageOf(album))} className="al-me" aria-label={`Your profile, ${album.me.name}`} aria-current={place.kind === "profile" ? "page" : undefined} onFollow={onFollow}>
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
