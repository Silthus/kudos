// PROTOTYPE (#625, round 3): the binder's cards: people, holo hoggies, team crests and empty pockets. Never merge to main.
import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { Rarity } from "../../../../../convex/hoggies/catalogue";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import type { Hoggie, Person, Team } from "../album";
import { rarityWords } from "./binderPages";

const tiltOf: Record<Rarity, number> = { common: 5, uncommon: 8, rare: 12, epic: 15, legendary: 18 };

const sheenOf: Record<Rarity, number> = { common: 0.18, uncommon: 0.28, rare: 0.42, epic: 0.55, legendary: 0.7 };

export function PersonCard({ person, colour, teamName, size = "pocket" }: { person: Pick<Person, "name" | "face" | "role" | "lead">; colour: string; teamName: string; size?: "pocket" | "big" }) {
  return (
    <span className={`pb-card pb-person pb-card-${size}`} style={{ "--frame": colour } as CSSProperties}>
      <span className="pb-person-portrait">
        <MemberFace face={person.face} className="pb-face" />
      </span>
      <span className="pb-person-name">{person.name}</span>
      <span className="pb-person-role">{person.role ?? "Teammate"}</span>
      <span className="pb-person-team">
        {teamName}
        {person.lead && " · Lead"}
      </span>
    </span>
  );
}

export function HoggieCard({ hoggie, size = "pocket", copy }: { hoggie: Pick<Hoggie, "hoggie" | "name" | "rarity">; size?: "pocket" | "big"; copy?: number }) {
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
    <span ref={card} onPointerMove={follow} onPointerLeave={rest} data-rarity={hoggie.rarity} className={`pb-card pb-hoggie pb-card-${size}`} style={{ "--rarity": `var(--rarity-${hoggie.rarity})`, "--sheen": sheenOf[hoggie.rarity] } as CSSProperties}>
      <span className="pb-hoggie-art">
        <HoggieArt slug={hoggie.hoggie} size={size === "big" ? 200 : 96} />
      </span>
      <span className="pb-hoggie-name">{hoggie.name}</span>
      <span className="pb-hoggie-rarity">
        {rarityWords[hoggie.rarity]}
        {copy !== undefined && copy > 1 && ` · Copy #${copy}`}
      </span>
      <span aria-hidden="true" className="pb-foil" />
    </span>
  );
}

export function CrestCard({ team, colour }: { team: Team; colour: string }) {
  return (
    <span className={`pb-card pb-crest ${team.complete ? "pb-crest-complete" : ""}`} style={{ "--frame": colour } as CSSProperties}>
      <CrestArt art={team.art} size={84} name={team.name} />
      <span className="pb-crest-name">{team.name}</span>
      <span className="pb-crest-count">
        {team.held}/{team.total} collected
      </span>
      {team.complete ? <span className="pb-crest-done">Set complete</span> : <span className="pb-crest-left">{team.total - team.held} to go</span>}
    </span>
  );
}

export function EmptyPocket({ label, hint, children }: { label: string; hint: string; children?: ReactNode }) {
  return (
    <span className="pb-empty">
      {children}
      <span className="pb-empty-name">{label}</span>
      <span className="pb-empty-hint">{hint}</span>
    </span>
  );
}

export function CardBack() {
  return (
    <span className="pb-card pb-card-back">
      <span className="pb-card-back-mark">HedgeHug</span>
    </span>
  );
}

export function MissingHoggie({ hoggie }: { hoggie: Hoggie }) {
  return (
    <EmptyPocket label="?" hint={rarityWords[hoggie.rarity]}>
      <span className="pb-empty-silhouette">
        <HoggieArt slug={hoggie.hoggie} size={64} silhouette />
      </span>
    </EmptyPocket>
  );
}
