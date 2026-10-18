// PROTOTYPE (#625, round 5): the cards of a pack: the booster wrapper, the person card with its team tally, the holo hoggie and the card back. Never merge to main.
import { useRef, type CSSProperties, type PointerEvent } from "react";
import type { Rarity } from "../../../../../convex/hoggies/catalogue";
import type { TeamArt } from "../../../crates/TeamCrest";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { personOf, type Album, type Hoggie, type Pack, type Person } from "../../round-3/album";
import { clipped, firstNameOf } from "./motion";

export const rarityWords: Record<Rarity, string> = { common: "Common", uncommon: "Uncommon", rare: "Rare", epic: "Epic", legendary: "Legendary" };

const teamPalette = ["#1D4AFF", "#F54E00", "#B62AD9", "#1E8C78", "#C27A00", "#2F6FD6", "#D2366B", "#5A6B23"];

export function teamColourOf(album: Album, team: string) {
  const index = album.teams.findIndex((entry) => entry.team === team);
  return teamPalette[Math.max(0, index) % teamPalette.length]!;
}

export type Tally = { name: string; art: TeamArt; held: number; total: number; justCompleted: boolean; ticking: boolean };

export function PersonCard({ person, colour, tally }: { person: Pick<Person, "name" | "face" | "role" | "lead">; colour: string; tally: Tally | null }) {
  return (
    <span className="r5o-card r5o-person" style={{ "--frame": colour } as CSSProperties}>
      <span className="r5o-person-portrait">
        <MemberFace face={person.face} className="r5o-face" />
        {tally?.justCompleted && (
          <span className="r5o-stamp" aria-hidden="true">
            <CrestArt art={tally.art} size={64} name={tally.name} />
          </span>
        )}
      </span>
      <span className="r5o-person-name">{person.name}</span>
      <span className="r5o-person-role">
        {person.role ?? "Teammate"}
        {person.lead && " · Lead"}
      </span>
      {tally !== null && <TeamTally tally={tally} />}
    </span>
  );
}

function TeamTally({ tally }: { tally: Tally }) {
  const before = tally.ticking ? tally.held - 1 : tally.held;
  const style = { "--from": `${(before / tally.total) * 100}%`, "--to": `${(tally.held / tally.total) * 100}%` } as CSSProperties;
  return (
    <span className="r5o-tally" data-ticking={tally.ticking ? "" : undefined} data-complete={tally.justCompleted ? "" : undefined} style={style}>
      <span className="r5o-tally-crest">
        <CrestArt art={tally.art} size={22} />
      </span>
      <span className="r5o-tally-name">{tally.name}</span>
      <span className="r5o-tally-count" aria-label={`${tally.held} of ${tally.total} collected`}>
        {tally.ticking && (
          <span className="r5o-tally-before" aria-hidden="true">
            {before}/{tally.total}
          </span>
        )}
        <span className="r5o-tally-after" aria-hidden="true">
          {tally.held}/{tally.total}
        </span>
      </span>
      <span className="r5o-tally-bar" aria-hidden="true">
        <span className="r5o-tally-fill" />
      </span>
    </span>
  );
}

const tiltOf: Record<Rarity, number> = { common: 5, uncommon: 8, rare: 12, epic: 15, legendary: 18 };

const sheenOf: Record<Rarity, number> = { common: 0.18, uncommon: 0.28, rare: 0.42, epic: 0.55, legendary: 0.7 };

export function HoggieCard({ hoggie, copy }: { hoggie: Pick<Hoggie, "hoggie" | "name" | "rarity">; copy: number }) {
  const card = useRef<HTMLSpanElement>(null);
  const follow = (event: PointerEvent<HTMLSpanElement>) => {
    const element = card.current;
    if (element === null) return;
    const box = element.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    const tilt = tiltOf[hoggie.rarity];
    element.style.setProperty("--ry", `${(x - 0.5) * tilt * 2}deg`);
    element.style.setProperty("--rx", `${(0.5 - y) * tilt * 2}deg`);
    element.style.setProperty("--mx", `${x * 100}%`);
    element.style.setProperty("--my", `${y * 100}%`);
    element.dataset.tilting = "";
  };
  const rest = () => {
    const element = card.current;
    if (element === null) return;
    element.style.setProperty("--rx", "0deg");
    element.style.setProperty("--ry", "0deg");
    delete element.dataset.tilting;
  };
  return (
    <span ref={card} onPointerMove={follow} onPointerLeave={rest} data-rarity={hoggie.rarity} className="r5o-card r5o-hoggie" style={{ "--rarity": `var(--rarity-${hoggie.rarity})`, "--sheen": sheenOf[hoggie.rarity] } as CSSProperties}>
      <span className="r5o-hoggie-art">
        <HoggieArt slug={hoggie.hoggie} size={200} />
      </span>
      <span className="r5o-hoggie-name">{hoggie.name}</span>
      <span className="r5o-hoggie-rarity">
        {rarityWords[hoggie.rarity]}
        {copy > 1 && ` · Copy #${copy}`}
      </span>
      <span aria-hidden="true" className="r5o-foil" />
    </span>
  );
}

export function CardBack() {
  return (
    <span className="r5o-card r5o-card-back">
      <span className="r5o-card-back-mark">HedgeHug</span>
    </span>
  );
}

export function PackWrapper({ album, pack, size }: { album: Album; pack: Pack; size: "big" | "mini" }) {
  const person = personOf(album, pack.person);
  const colour = teamColourOf(album, person?.teams[0] ?? "");
  return (
    <span className={`r5o-pack r5o-pack-${size}`} style={{ "--frame": colour } as CSSProperties}>
      <span className="r5o-pack-crimp r5o-pack-crimp-top" />
      <span className="r5o-pack-brand">HedgeHug</span>
      <span className="r5o-pack-kind">Booster pack</span>
      {person !== undefined && (
        <span className="r5o-pack-face">
          <MemberFace face={person.face} className="r5o-pack-face-img" />
        </span>
      )}
      <span className="r5o-pack-for">For thanking {person === undefined ? "a teammate" : firstNameOf(person.name)}</span>
      {size === "big" && <span className="r5o-pack-quote">“{clipped(pack.message, 96)}”</span>}
      <span className="r5o-pack-contents">1 card · 1 hoggie</span>
      <span className="r5o-pack-crimp r5o-pack-crimp-bottom" />
    </span>
  );
}
