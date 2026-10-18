// PROTOTYPE (#625, round 6): pieces every person page shares: your history with them, their hype emoji, how to collect them, and the way back to their team. Never merge to main.
import { AppLink } from "../../../../AppLink";
import type { Album, Person, Team } from "../../../round-3/album";
import { EmojiArt } from "../../shell/EmojiArt";
import { dateOf, firstNameOf, howToCollect, hypeEmojiOf, packFor, teamHref } from "./team";
import { OpenThePack } from "./OpenThePack";

export type Fact = { label: string; value: string };

export function factsOf(person: Person): Fact[] {
  const { stats } = person;
  return [
    { label: "First thanked", value: stats.firstThankedAt === null ? "Not yet" : dateOf(stats.firstThankedAt) },
    { label: "Kudos you gave", value: String(stats.kudosGiven) },
    { label: "Kudos they gave you", value: String(stats.kudosReceived) },
    { label: "Hugs you gave", value: String(stats.hugsGiven) },
    { label: "Hugs they gave you", value: String(stats.hugsReceived) },
  ];
}

export function PersonFacts({ person }: { person: Person }) {
  return (
    <dl className="r6t-facts">
      {factsOf(person).map(({ label, value }) => (
        <div key={label} className="r6t-fact">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BestMessage({ person, className = "" }: { person: Person; className?: string }) {
  if (person.stats.bestMessage === null) return null;
  return (
    <figure className={`r6t-quote ${className}`}>
      <blockquote>“{person.stats.bestMessage}”</blockquote>
      <figcaption>Your best message to {firstNameOf(person.name)}</figcaption>
    </figure>
  );
}

export function HowTo({ album, person }: { album: Album; person: Person }) {
  const waiting = packFor(album, person) !== undefined;
  return (
    <div className="r6t-howto">
      <p className="r6t-eyebrow">How to collect {firstNameOf(person.name)}</p>
      <p>{howToCollect(album, person)}</p>
      {waiting && (
        <OpenThePack />
      )}
    </div>
  );
}

export function HypeEmoji({ album, person }: { album: Album; person: Person }) {
  const emoji = hypeEmojiOf(album, person);
  if (emoji === undefined) return null;
  const first = firstNameOf(person.name);
  return (
    <div className={`r6t-hype ${emoji.unlocked ? "r6t-hype-in" : "r6t-hype-out"}`}>
      <EmojiArt album={album} emoji={emoji} size={48} />
      <p>
        <code>{emoji.name}</code>
        <span>{emoji.unlocked ? `Unlocked when you first thanked ${first}` : `Give ${first} a thoughtful kudos to unlock their hype emoji`}</span>
      </p>
    </div>
  );
}

export function PackedThisWeek({ album, person }: { album: Album; person: Person }) {
  if (person.collectedAt === null || !person.packedThisWeek) return null;
  return <p className="r6t-note">{howToCollect(album, person)}</p>;
}

export function BackToTeam({ team }: { team: Team | undefined }) {
  if (team === undefined) return null;
  return (
    <AppLink href={teamHref(team)} className="r6t-back">
      ← {team.name}
    </AppLink>
  );
}

export function Missing() {
  return (
    <article className="r6t">
      <h1 className="r6t-title">Nobody here yet</h1>
      <p className="r6t-quiet">This teammate isn't on any team page.</p>
    </article>
  );
}
