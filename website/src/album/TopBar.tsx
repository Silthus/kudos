import { IconCrown, IconEmoji, IconGear, IconPulse, IconStack } from "@posthog/icons";
import { useId, type ComponentType, type ReactNode } from "react";
import { AppLink } from "../AppLink";
import { MemberFace } from "../Face";
import { HedgehogSitting } from "../hoggies";
import type { Album, AlbumLevel } from "./answer";
import { earnedEmojisOf, levelShareOf, plural, xpToNextOf } from "./facts";
import { hrefOf, type Place } from "./place";
import { usePopover, type Popover } from "./usePopover";

type TopBarProps = { album: Album; place: Place; wide: boolean };

export function TopBar({ album, place, wide }: TopBarProps) {
  const popover = usePopover<"tray" | "emojis" | "menu">();
  return (
    <header className="al-top">
      <AppLink href="/" className="al-brand">
        <HedgehogSitting size={30} />
        <span className="al-brand-word">HedgeHug</span>
      </AppLink>
      <XpBar level={album.level} />
      <div className="al-top-end">
        <PacksButton waiting={album.packs.length} more={album.morePacks} current={place.kind === "packs"} />
        <TrayButton items={album.tray.length} popover={popover} />
        {wide && <PageLinks place={place} />}
        <EmojiButton earned={earnedEmojisOf(album)} popover={popover} />
        {wide ? <MeAndSettings album={album} place={place} /> : <Menu album={album} place={place} popover={popover} />}
      </div>
    </header>
  );
}

function XpBar({ level }: { level: AlbumLevel }) {
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

function PacksButton({ waiting, more, current }: { waiting: number; more: boolean; current: boolean }) {
  const count = more ? `${waiting}+` : `${waiting}`;
  return (
    <AppLink href={hrefOf({ kind: "packs" })} className="al-packs" data-waiting={waiting > 0 ? "" : undefined} aria-current={current ? "page" : undefined} aria-label={waiting === 0 ? "No packs waiting" : `Open your packs, ${count} waiting`}>
      <span className="al-packs-art" aria-hidden="true">
        <span className="al-packs-wrapper" />
        <span className="al-packs-wrapper" />
        {waiting > 0 && <span className="al-packs-count">{count}</span>}
      </span>
      <span className="al-packs-words" aria-hidden="true">
        <strong>{waiting === 0 ? "No packs" : more ? `${count} packs` : plural(waiting, "pack", "packs")}</strong>
        <span>{waiting === 0 ? "Say thanks to earn one" : "Ready to open"}</span>
      </span>
    </AppLink>
  );
}

function TrayButton({ items, popover }: { items: number; popover: Popover<"tray" | "emojis" | "menu"> }) {
  return (
    <PopoverButton name="tray" popover={popover} label={items === 0 ? "Tray, nothing to put in" : `Tray, ${items} to put in`} panelLabel="Tray" className="al-tray" content={<p>Open a pack and what it holds waits here to be put in.</p>}>
      <IconStack />
      {items > 0 && <span className="al-tray-count">{items}</span>}
    </PopoverButton>
  );
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

type PopoverButtonProps = { name: "tray" | "emojis" | "menu"; popover: Popover<"tray" | "emojis" | "menu">; label: string; panelLabel: string; className: string; content: ReactNode; children: ReactNode };

function PopoverButton({ name, popover, label, panelLabel, className, content, children }: PopoverButtonProps) {
  const panel = useId();
  const open = popover.open === name;
  return (
    <span className="al-popover-anchor" ref={open ? popover.anchor : undefined}>
      <button type="button" className={`al-top-button ${className}`} aria-label={label} aria-expanded={open} aria-controls={open ? panel : undefined} onClick={() => popover.toggle(name)}>
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
