// PROTOTYPE (#625, round 4): small pieces the three activity layouts share: people, quotes, packs, quiet hugs and the filter. Never merge to main.
import type { ReactNode } from "react";
import { AppLink } from "../../../../AppLink";
import { CrestArt, HoggieArt, MemberFace } from "../../../art";
import type { Album, Moment, Person } from "../../../round-3/album";
import { hrefOf } from "../../address";

export type Thanks = Extract<Moment, { kind: "thoughtful-given" | "thoughtful-received" }>;

export type Hug = Extract<Moment, { kind: "hug-given" | "hug-received" }>;

export type Opening = Extract<Moment, { kind: "pack-opened" }>;

export function isThanks(moment: Moment): moment is Thanks {
  return moment.kind === "thoughtful-given" || moment.kind === "thoughtful-received";
}

export function isHug(moment: Moment): moment is Hug {
  return moment.kind === "hug-given" || moment.kind === "hug-received";
}

export function isOpening(moment: Moment): moment is Opening {
  return moment.kind === "pack-opened";
}

export function isGiven(moment: Moment) {
  return moment.kind === "thoughtful-given" || moment.kind === "hug-given";
}

export function isReceived(moment: Moment) {
  return moment.kind === "thoughtful-received" || moment.kind === "hug-received";
}

export function personIn(album: Album, key: string): Person | undefined {
  return album.people.find((person) => person.key === key);
}

export function firstNameOf(name: string) {
  return name.split(" ")[0] ?? name;
}

export function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

export function homeTeamOf(album: Album, person: Person) {
  return album.teams.find(({ team }) => team === person.teams[0]);
}

export function Face({ album, person: key, size = "m" }: { album: Album; person: string; size?: "s" | "m" | "l" }) {
  const person = personIn(album, key);
  if (person === undefined) return <span className={`r4-act-face r4-act-face-${size}`} />;
  return (
    <AppLink href={hrefOf({ kind: "person", key })} className="r4-act-face-link" tabIndex={-1} aria-hidden="true">
      <MemberFace face={person.face} className={`r4-act-face r4-act-face-${size}`} />
    </AppLink>
  );
}

export function Name({ album, person: key, first = false }: { album: Album; person: string; first?: boolean }) {
  const person = personIn(album, key);
  if (person === undefined) return <span>someone</span>;
  return (
    <AppLink href={hrefOf({ kind: "person", key })} className="r4-act-name">
      {first ? firstNameOf(person.name) : person.name}
    </AppLink>
  );
}

export function TeamTag({ album, person: key }: { album: Album; person: string }) {
  const person = personIn(album, key);
  const team = person === undefined ? undefined : homeTeamOf(album, person);
  if (team === undefined) return null;
  return (
    <span className="r4-act-team">
      <CrestArt art={team.art} size={18} />
      {team.name}
    </span>
  );
}

export function Quote({ message, tone, big = false }: { message: string; tone: "given" | "received"; big?: boolean }) {
  return <blockquote className={`r4-act-quote r4-act-quote-${tone} ${big ? "r4-act-quote-big" : ""}`}>“{message}”</blockquote>;
}

export function PackNote({ packed }: { packed: boolean }) {
  if (packed) return <span className="r4-act-pill r4-act-pill-pack">Pack earned</span>;
  return <span className="r4-act-pill">Counted · their pack is already in this week</span>;
}

export function HoggieFound({ album, opening, size = 44 }: { album: Album; opening: Opening; size?: number }) {
  const hoggie = album.hoggies.find(({ hoggie: slug }) => slug === opening.hoggie);
  return (
    <span className="r4-act-hoggie">
      <span className="r4-act-hoggie-art">
        <HoggieArt slug={opening.hoggie} size={size} />
      </span>
      {hoggie !== undefined && (
        <span className="r4-act-hoggie-words">
          <strong>{hoggie.name}</strong>
          <span className={`r4-act-rarity r4-act-rarity-${hoggie.rarity}`}>{hoggie.rarity}</span>
        </span>
      )}
    </span>
  );
}

export function OpeningLine({ album, opening }: { album: Album; opening: Opening }) {
  return (
    <>
      You opened <Name album={album} person={opening.person} first />
      ’s pack
      {opening.newPerson && <span className="r4-act-pill r4-act-pill-new">New in your album</span>}
    </>
  );
}

export type HugCount = { person: string; count: number };

export function hugCountsOf(hugs: Hug[]): HugCount[] {
  const counts = new Map<string, number>();
  for (const { person } of hugs) counts.set(person, (counts.get(person) ?? 0) + 1);
  return [...counts.entries()].map(([person, count]) => ({ person, count })).toSorted((first, second) => second.count - first.count);
}

function joined(parts: ReactNode[]) {
  return parts.flatMap((part, index) => {
    if (index === 0) return [part];
    return [index === parts.length - 1 ? " and " : ", ", part];
  });
}

export function HugSentence({ album, direction, hugs, span = "" }: { album: Album; direction: "given" | "received"; hugs: Hug[]; span?: string }) {
  const counts = hugCountsOf(hugs);
  const shown = counts.slice(0, 4);
  const others = counts.slice(4).reduce((sum, { count }) => sum + count, 0);
  const parts = shown.map(({ person, count }, index) => (
    <span key={person}>
      {index === 0 ? plural(count, "hug") : count} {direction === "received" ? "from" : "to"} <Name album={album} person={person} first />
    </span>
  ));
  const all = others === 0 ? parts : [...parts, <span key="others">{others} more</span>];
  return (
    <span className="r4-act-hug-sentence">
      {direction === "given" && "You gave "}
      {joined(all)}
      {span}
    </span>
  );
}

export function HugFaces({ album, hugs }: { album: Album; hugs: Hug[] }) {
  return (
    <span className="r4-act-hug-faces" aria-hidden="true">
      {hugCountsOf(hugs)
        .slice(0, 3)
        .map(({ person }) => (
          <Face key={person} album={album} person={person} size="s" />
        ))}
    </span>
  );
}

export function Segmented<Value extends string>({ label, options, value, onChoose }: { label: string; options: readonly { value: Value; label: string }[]; value: Value; onChoose: (value: Value) => void }) {
  return (
    <div className="r4-act-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChoose(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PageHead({ title, lede, children }: { title: string; lede: string; children?: ReactNode }) {
  return (
    <header className="r4-act-head">
      <div>
        <p className="r4-act-eyebrow">Activity</p>
        <h1 className="r4-act-title">{title}</h1>
        <p className="r4-act-lede">{lede}</p>
      </div>
      {children}
    </header>
  );
}
