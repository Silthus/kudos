// PROTOTYPE (#625, round 5): the top bar: brand, XP bar, packs waiting, your name and the settings cog. Never merge to main.
import { IconGear } from "@posthog/icons";
import type { MouseEvent } from "react";
import { AppLink } from "../../../AppLink";
import { HedgehogSitting } from "../../../hoggies";
import { MemberFace } from "../../art";
import { levelAt, useAlbum } from "../../round-3/album";
import type { Place } from "../address";
import { openPacks, packsHrefHere } from "./history";
import { useCountUp, useGain, useHeldXp } from "./motion";

export function TopBar({ place, chip, packsOpen }: { place: Place; chip: string; packsOpen: boolean }) {
  const { album } = useAlbum();
  return (
    <header className="r5-top">
      <AppLink href="/" className="r5-brand">
        <HedgehogSitting size={30} />
        <span className="r5-brand-word">HedgeHug</span>
      </AppLink>
      <XpBar xp={album.level.xp} />
      <div className="r5-top-end">
        <span className="r5-layout-chip" data-prototype-chip>
          {chip}
        </span>
        <PacksButton waiting={album.packs.length} open={packsOpen} />
        <span className="r5-me">
          <MemberFace face={album.me.face} className="r5-me-face" />
          <span className="r5-me-name">{album.me.name}</span>
          <AppLink href="/settings" aria-label="Settings" className="r5-cog" aria-current={place.kind === "settings" ? "page" : undefined}>
            <IconGear />
          </AppLink>
        </span>
      </div>
    </header>
  );
}

function XpBar({ xp }: { xp: number }) {
  const held = useHeldXp();
  const target = held ?? xp;
  const shown = useCountUp(target);
  const gain = useGain(target);
  const level = levelAt(Math.round(shown));
  const counting = Math.round(shown) !== target;
  return (
    <div className="r5-xp" data-counting={counting ? "" : undefined}>
      <span className="r5-level">Level {level.level}</span>
      <span className="r5-xp-track" aria-hidden="true">
        <span className="r5-xp-fill" style={{ width: `${Math.max(3, level.progress * 100)}%` }} />
      </span>
      <span className="r5-xp-words">
        {level.toNext} XP to level {level.level + 1}
      </span>
      {gain !== null && (
        <span key={gain.key} className="r5-xp-gain" aria-hidden="true">
          +{gain.amount} XP
        </span>
      )}
    </div>
  );
}

function PacksButton({ waiting, open }: { waiting: number; open: boolean }) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!open) openPacks();
  };
  return (
    <a href={packsHrefHere()} onClick={follow} className="r5-packs" data-waiting={waiting > 0 ? "" : undefined} aria-current={open ? "page" : undefined} aria-label={waiting === 0 ? "No packs waiting" : `Open your packs, ${waiting} waiting`}>
      <span className="r5-packs-art" aria-hidden="true">
        <span className="r5-packs-wrapper" />
        <span className="r5-packs-wrapper" />
        {waiting > 0 && <span className="r5-packs-count">{waiting}</span>}
      </span>
      <span className="r5-packs-words" aria-hidden="true">
        <strong>{waiting === 0 ? "No packs" : waiting === 1 ? "1 pack" : `${waiting} packs`}</strong>
        <span>{waiting === 0 ? "Say thanks to earn one" : "Ready to open"}</span>
      </span>
    </a>
  );
}
