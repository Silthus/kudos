// PROTOTYPE (#625, round 3): the printed pages of the sticker album: contents, team spreads, shiny hoggies and records. Never merge to main.
import type { CSSProperties } from "react";
import type { Album, Hoggie, Milestone, Team } from "../album";
import { AchievementEmblem, CrestArt, TierMedal } from "../../art";
import { AppLink } from "../../../AppLink";
import { HedgehogReading } from "../../../hoggies";
import { dateWords, firstNameOf, hrefOfSpread, membersOf, pageNumberOf, plural, rarityOrder, rarityWords, type Landing, type Rarity, type Spread } from "./model";
import { HoggieSlot, PersonSlot } from "./Stickers";

export type PageContext = {
  album: Album;
  spreads: Spread[];
  numbers: Map<string, number>;
  landing: Landing | null;
  ticked: boolean;
  onOpenPerson: (key: string) => void;
};

export function Page({ spread, index, side, context }: { spread: Spread; index: number; side: "left" | "right"; context: PageContext }) {
  return (
    <section className={`sa-page sa-page-${side}`} aria-label={index === 0 && side === "left" ? "Inside cover" : `Page ${pageNumberOf(index, side)}`}>
      <div className="sa-page-inner">
        <PageBody spread={spread} index={index} side={side} context={context} />
      </div>
      {!(index === 0 && side === "left") && <span className="sa-folio">{pageNumberOf(index, side)}</span>}
    </section>
  );
}

function PageBody({ spread, index, side, context }: { spread: Spread; index: number; side: "left" | "right"; context: PageContext }) {
  if (spread.kind === "contents") return side === "left" ? <InsideCover album={context.album} /> : <Contents context={context} />;
  if (spread.kind === "team") return side === "left" ? <TeamHeader team={spread.team} colour={spread.colour} index={index} context={context} /> : <TeamStickers team={spread.team} colour={spread.colour} context={context} />;
  if (spread.kind === "hoggies") return <HoggiePage rarity={spread.rarity} side={side} context={context} />;
  return <RecordsPage side={side} album={context.album} />;
}

function InsideCover({ album }: { album: Album }) {
  return (
    <div className="sa-inside">
      <p className="sa-kicker">This album belongs to</p>
      <h2 className="sa-owner">{album.me.name}</h2>
      <div className="sa-inside-badges">
        <LevelPin level={album.level.level} />
        <span>
          <strong>{album.collected}</strong> people collected
          <br />
          <strong>{album.hoggiesFound}</strong> of {album.hoggies.length} hoggies found
        </span>
      </div>
      <h3 className="sa-inside-title">How this album fills up</h3>
      <ol className="sa-how">
        <li>
          <b>Thank someone in Slack and say why.</b> That earns a pack, once a week per person.
        </li>
        <li>
          <b>Open the pack.</b> Their sticker is inside the first time you thank them, plus a surprise hoggie.
        </li>
        <li>
          <b>Fill every team page.</b> A full page gets the "Page complete!" stamp.
        </li>
      </ol>
      <p className="sa-quiet">A hug (reacting with the kudos emoji) is a quiet +1 XP.</p>
      <span className="sa-inside-hog" aria-hidden="true">
        <HedgehogReading size={150} />
      </span>
    </div>
  );
}

export function LevelPin({ level, large = false }: { level: number; large?: boolean }) {
  return (
    <span className={`sa-pin ${large ? "sa-pin-large" : ""}`} aria-label={`Level ${level}`}>
      <span className="sa-pin-face">
        <span className="sa-pin-word">LVL</span>
        <span className="sa-pin-number">{level}</span>
      </span>
    </span>
  );
}

function Contents({ context }: { context: PageContext }) {
  const { album, spreads } = context;
  const hoggieStart = spreads.findIndex(({ kind }) => kind === "hoggies");
  const records = spreads.findIndex(({ kind }) => kind === "records");
  return (
    <div className="sa-contents">
      <h2 className="sa-page-title">Contents</h2>
      <ul className="sa-toc">
        {spreads.map((spread, index) =>
          spread.kind !== "team" ? null : (
            <li key={spread.team.team}>
              <AppLink href={hrefOfSpread(spread)} className="sa-toc-row">
                <CrestArt art={spread.team.art} size={30} name={spread.team.name} />
                <span className="sa-toc-name">
                  {spread.team.name}
                  {spread.team.mine && <span className="sa-mine">your team</span>}
                </span>
                <span className="sa-toc-dots" />
                <span className={`sa-toc-progress ${spread.team.complete ? "sa-toc-complete" : ""}`}>{spread.team.complete ? "Complete" : `${spread.team.held}/${spread.team.total}`}</span>
                <span className="sa-toc-page">{pageNumberOf(index, "left")}</span>
              </AppLink>
            </li>
          ),
        )}
        <li className="sa-toc-gap">
          <AppLink href="/book#hoggies" className="sa-toc-row">
            <span className="sa-toc-icon" aria-hidden="true">✦</span>
            <span className="sa-toc-name">Shiny hoggies</span>
            <span className="sa-toc-dots" />
            <span className="sa-toc-progress">
              {album.hoggiesFound}/{album.hoggies.length}
            </span>
            <span className="sa-toc-page">{pageNumberOf(hoggieStart, "left")}</span>
          </AppLink>
        </li>
        <li>
          <AppLink href="/book/earned" className="sa-toc-row">
            <span className="sa-toc-icon" aria-hidden="true">★</span>
            <span className="sa-toc-name">Records</span>
            <span className="sa-toc-dots" />
            <span className="sa-toc-progress">{album.milestones.reduce((sum, { tiers }) => sum + tiers.filter(({ earnedAt }) => earnedAt !== null).length, 0)} earned</span>
            <span className="sa-toc-page">{pageNumberOf(records, "left")}</span>
          </AppLink>
        </li>
      </ul>
    </div>
  );
}

function TeamHeader({ team, colour, index, context }: { team: Team; colour: string; index: number; context: PageContext }) {
  const { album, landing, ticked } = context;
  const landingHere = landing?.step === "person" && landing.team === team.team;
  const justCompleted = landingHere && (landing.opening.teams.find((entry) => entry.team === team.team)?.justCompleted ?? false);
  const held = landingHere && !ticked ? team.held - 1 : team.held;
  const stamped = team.complete && !(justCompleted && !ticked);
  const { captains, others } = membersOf(team, album);
  const people = [...captains, ...others];
  const thanked = people.filter(({ stats, collectedAt }) => collectedAt !== null || stats.kudosGiven > 0).length;
  const sum = (pick: (person: (typeof people)[number]) => number) => people.reduce((total, person) => total + pick(person), 0);
  const missing = people.filter(({ collectedAt }) => collectedAt === null);
  const captainsHere = team.total > 6;
  const bestWords = captainsHere ? undefined : people.find(({ stats }) => stats.bestMessage !== null);
  return (
    <div className="sa-team-head" style={{ "--team": colour } as CSSProperties}>
      <div className="sa-team-banner">
        <span className="sa-team-crest">
          <CrestArt art={team.art} size={112} name={team.name} />
        </span>
        <div>
          <p className="sa-kicker">Team page · {pageNumberOf(index, "left")}</p>
          <h2 className="sa-team-name">{team.name}</h2>
          {team.mine && <span className="sa-mine">your team</span>}
        </div>
        {stamped && <span className={`sa-stamp ${justCompleted ? "sa-stamp-fresh" : ""}`}>Page complete!</span>}
      </div>
      <div className="sa-team-progress" aria-label={`${held} of ${team.total} stickers`}>
        <span className="sa-team-count">
          <b key={held} className={landingHere && ticked ? "sa-tick" : undefined}>
            {held}
          </b>{" "}
          of {team.total} stickers
        </span>
        <span className="sa-team-bar">
          <span style={{ width: `${(held / Math.max(1, team.total)) * 100}%` }} />
        </span>
      </div>
      {captainsHere ? (
        <div className="sa-captains">
          {captains.map((person) => (
            <PersonSlot key={person.key} person={person} number={context.numbers.get(`${team.team}:${person.key}`) ?? 0} look={{ width: 132, colour, captain: true }} teamName={team.name} landing={landingHere && landing.opening.person.key === person.key} onOpen={() => context.onOpenPerson(person.key)} />
          ))}
        </div>
      ) : null}
      <dl className="sa-team-stats">
        <div>
          <dt>Thanked</dt>
          <dd>
            {thanked} of {team.total}
          </dd>
        </div>
        <div>
          <dt>Kudos</dt>
          <dd>
            {sum(({ stats }) => stats.kudosGiven)} given · {sum(({ stats }) => stats.kudosReceived)} back
          </dd>
        </div>
        <div>
          <dt>Hugs</dt>
          <dd>
            {sum(({ stats }) => stats.hugsGiven)} given · {sum(({ stats }) => stats.hugsReceived)} back
          </dd>
        </div>
      </dl>
      {missing.length > 0 && !captainsHere && (
        <p className="sa-team-next">
          {missing.length === 1 ? `One sticker to go: thank ${firstNameOf(missing[0]!.name)} and say why.` : `Still missing: ${missing.map(({ name }) => firstNameOf(name)).join(", ")}. Thank one of them and say why.`}
        </p>
      )}
      {missing.length > 0 && captainsHere && <p className="sa-team-next">{plural(missing.length, "sticker")} to go on this page.</p>}
      {bestWords !== undefined && (
        <figure className="sa-team-quote">
          <figcaption>Your kindest words on this page, to {firstNameOf(bestWords.name)}</figcaption>
          <blockquote>“{bestWords.stats.bestMessage}”</blockquote>
        </figure>
      )}
    </div>
  );
}

function TeamStickers({ team, colour, context }: { team: Team; colour: string; context: PageContext }) {
  const { album, landing } = context;
  const { captains, others } = membersOf(team, album);
  const captainsHere = team.total <= 6;
  const width = slotWidthFor(others.length, captainsHere && captains.length > 0);
  const landingKey = landing?.step === "person" && landing.team === team.team ? landing.opening.person.key : null;
  const slot = (person: (typeof others)[number], captain: boolean, size: number) => (
    <PersonSlot key={person.key} person={person} number={context.numbers.get(`${team.team}:${person.key}`) ?? 0} look={{ width: size, colour, captain }} teamName={team.name} landing={landingKey === person.key} onOpen={() => context.onOpenPerson(person.key)} />
  );
  return (
    <div className="sa-team-grid-page">
      {captainsHere && captains.length > 0 && <div className="sa-captains sa-captains-right">{captains.map((person) => slot(person, true, others.length === 0 ? 190 : 168))}</div>}
      <div className="sa-team-grid" style={{ "--cols": columnsFor(width) } as CSSProperties}>
        {others.map((person) => slot(person, false, width))}
      </div>
    </div>
  );
}

function slotWidthFor(count: number, withCaptains: boolean) {
  if (withCaptains) return count <= 3 ? 136 : 112;
  if (count <= 3) return 150;
  if (count <= 6) return 140;
  if (count <= 12) return 108;
  if (count <= 20) return 90;
  return 66;
}

function columnsFor(width: number) {
  return Math.max(1, Math.floor((500 + 12) / (width + 12)));
}

function HoggiePage({ rarity, side, context }: { rarity: Rarity; side: "left" | "right"; context: PageContext }) {
  const { album, landing, ticked } = context;
  const all = album.hoggies.filter((hoggie) => hoggie.rarity === rarity);
  const { width, leftCount } = hoggieLayoutOf(all.length);
  const shown = side === "left" ? all.slice(0, leftCount) : all.slice(leftCount);
  const landingSlug = landing?.step === "hoggie" && landing.opening.hoggie.rarity === rarity ? landing.opening.hoggie.hoggie : null;
  const found = all.filter(({ count }) => count > 0).length - (landingSlug !== null && !ticked && landing?.opening.hoggie.isNew ? 1 : 0);
  const prefix = rarity.charAt(0).toUpperCase();
  const numberOf = (hoggie: Hoggie) => `${prefix}${all.indexOf(hoggie) + 1}`;
  return (
    <div className="sa-hoggie-page" style={{ "--rarity": `var(--rarity-${rarity})` } as CSSProperties}>
      {side === "left" && (
        <header className="sa-hoggie-head">
          <p className="sa-kicker">Shiny hoggies · {rarityOrder.indexOf(rarity) + 1} of 5</p>
          <h2 className="sa-page-title">
            <span className="sa-rarity-dot" />
            {rarityWords[rarity]}
          </h2>
          <p className="sa-hoggie-count">
            <b key={found} className={landingSlug !== null && ticked ? "sa-tick" : undefined}>
              {found}
            </b>{" "}
            of {all.length} found · every pack holds one
          </p>
        </header>
      )}
      <div className="sa-hoggie-grid" style={{ "--cols": Math.max(1, Math.floor((500 + 10) / (width + 10))) } as CSSProperties}>
        {shown.map((hoggie) => (
          <HoggieSlot key={hoggie.hoggie} hoggie={hoggie} width={width} number={numberOf(hoggie)} landing={landingSlug === hoggie.hoggie} />
        ))}
      </div>
    </div>
  );
}

function hoggieLayoutOf(count: number) {
  for (const width of [150, 118, 96, 84, 72, 64, 58, 52]) {
    const cols = Math.floor((500 + 10) / (width + 10));
    const rowHeight = width * 1.12 + 10;
    const left = cols * Math.floor((440 + 10) / rowHeight);
    const right = cols * Math.floor((600 + 10) / rowHeight);
    if (left + right >= count) return { width, leftCount: Math.min(left, Math.ceil((count * left) / (left + right))) };
  }
  return { width: 52, leftCount: Math.ceil(count / 2) };
}

function RecordsPage({ side, album }: { side: "left" | "right"; album: Album }) {
  const shown = side === "left" ? album.milestones.slice(0, 2) : album.milestones.slice(2);
  return (
    <div className="sa-records">
      {side === "left" && (
        <header>
          <p className="sa-kicker">At the back of the album</p>
          <h2 className="sa-page-title">Records</h2>
          <p className="sa-quiet">Milestones for filling your album. They're just for the shelf: nothing to spend.</p>
        </header>
      )}
      {shown.map((milestone) => (
        <MilestoneCard key={milestone.id} milestone={milestone} />
      ))}
    </div>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const earned = milestone.tiers.filter(({ earnedAt }) => earnedAt !== null);
  const best = earned.at(-1);
  const next = milestone.tiers.find(({ earnedAt }) => earnedAt === null);
  return (
    <article className="sa-milestone">
      <span className="sa-milestone-emblem">
        <AchievementEmblem ladder={milestone.emblem} best={best?.tier ?? null} size={84} />
      </span>
      <div className="sa-milestone-body">
        <h3>{milestone.name}</h3>
        <p className="sa-quiet">
          {milestone.count} {milestone.counts}
          {next !== undefined ? ` · ${next.at - milestone.count} more to ${next.name}` : " · all tiers earned"}
        </p>
        <ol className="sa-tiers">
          {milestone.tiers.map((tier) => (
            <li key={tier.tier} className={tier.earnedAt === null ? "sa-tier-open" : undefined} title={tier.earnedAt === null ? `${tier.name}: ${tier.at} ${milestone.counts}` : `${tier.name}: earned ${dateWords(tier.earnedAt)}`}>
              <TierMedal tier={tier.tier} earned={tier.earnedAt !== null} size={30} />
              <span>{tier.name}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

