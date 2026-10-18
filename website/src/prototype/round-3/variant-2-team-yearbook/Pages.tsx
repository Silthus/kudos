// PROTOTYPE (#625, round 3) the yearbook's deep-dive pages: milestones, leaderboard and activity. Never merge to main.
import { AppLink } from "../../../AppLink";
import { AchievementEmblem, MemberFace, TierMedal } from "../../art";
import { useAlbum, type Album, type Milestone, type Moment } from "../album";
import { dateOf, firstNameOf, whenOf } from "./parts";

export function MilestonesPage() {
  const { album } = useAlbum();
  const earned = album.milestones.flatMap(({ tiers }) => tiers.filter(({ earnedAt }) => earnedAt !== null)).length;
  return (
    <main className="ty-page">
      <header className="ty-page-head">
        <p className="ty-eyebrow">Album milestones</p>
        <h1 className="ty-title">Milestones</h1>
        <p className="ty-muted">
          Marks your album earns as it fills. {earned} of {album.milestones.length * 4} tiers earned.
        </p>
      </header>
      <ul className="ty-milestones">
        {album.milestones.map((milestone) => (
          <MilestoneCard key={milestone.id} milestone={milestone} />
        ))}
      </ul>
    </main>
  );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const best = milestone.tiers.findLast(({ earnedAt }) => earnedAt !== null);
  const next = milestone.tiers.find(({ earnedAt }) => earnedAt === null);
  return (
    <li className="ty-milestone">
      <AchievementEmblem ladder={milestone.emblem} best={best?.tier ?? null} size={104} />
      <h2 className="ty-milestone-name">{milestone.name}</h2>
      <p className="ty-milestone-count">
        <strong>{milestone.count}</strong> {milestone.counts}
      </p>
      <ol className="ty-tiers">
        {milestone.tiers.map((tier) => (
          <li key={tier.tier} className={`ty-tier ${tier.earnedAt === null ? "ty-tier-out" : ""}`}>
            <TierMedal tier={tier.tier} earned={tier.earnedAt !== null} size={26} />
            <span className="ty-tier-name">{tier.name}</span>
            <span className="ty-tier-when">{tier.earnedAt === null ? `at ${tier.at}` : dateOf(tier.earnedAt)}</span>
          </li>
        ))}
      </ol>
      <p className="ty-milestone-next">{next === undefined ? "Every tier earned." : `${next.at - milestone.count} more to ${next.name}.`}</p>
    </li>
  );
}

export function LeaderboardPage() {
  const { album } = useAlbum();
  return (
    <main className="ty-page ty-narrow">
      <header className="ty-page-head">
        <p className="ty-eyebrow">This week</p>
        <h1 className="ty-title">Leaderboard</h1>
        <p className="ty-muted">Thoughtful kudos given this week: thank-yous that say why.</p>
      </header>
      <ol className="ty-board">
        {album.board.map((row) => (
          <li key={row.name} className={`ty-board-row ${row.you ? "ty-board-you" : ""}`}>
            <span className="ty-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="ty-board-face" />
            <span className="ty-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="ty-board-score">
              <strong>{row.thoughtful}</strong> thoughtful
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}

export function ActivityPage() {
  const { album } = useAlbum();
  return (
    <main className="ty-page ty-narrow">
      <header className="ty-page-head">
        <p className="ty-eyebrow">Recently</p>
        <h1 className="ty-title">Activity</h1>
        <p className="ty-muted">Thank-yous and hugs, both ways, and the packs you opened.</p>
      </header>
      <ol className="ty-feed">
        {album.moments.map((moment, index) => (
          <MomentRow key={`${moment.kind}-${moment.at}-${index}`} album={album} moment={moment} />
        ))}
      </ol>
    </main>
  );
}

function MomentRow({ album, moment }: { album: Album; moment: Moment }) {
  const person = album.people.find(({ key }) => key === moment.person);
  const name = person?.name ?? "A teammate";
  const first = firstNameOf(name);
  return (
    <li className="ty-moment">
      {person === undefined ? <span className="ty-moment-face" /> : <MemberFace face={person.face} className="ty-moment-face" />}
      <div className="ty-moment-words">
        <p>
          {sentenceOf(album, moment, name)}{" "}
          {person !== undefined && (
            <AppLink href={`/book#people/${person.key}`} className="ty-link">
              {first}'s page
            </AppLink>
          )}
        </p>
        {"message" in moment && <p className="ty-moment-quote">“{moment.message}”</p>}
        <p className="ty-moment-when">{whenOf(moment.at)}</p>
      </div>
    </li>
  );
}

function sentenceOf(album: Album, moment: Moment, name: string) {
  if (moment.kind === "thoughtful-given") return moment.packed ? `You thanked ${name} and earned a pack.` : `You thanked ${name}.`;
  if (moment.kind === "thoughtful-received") return `${name} thanked you.`;
  if (moment.kind === "hug-given") return `You hugged ${name}.`;
  if (moment.kind === "hug-received") return `${name} hugged you.`;
  const hoggie = album.hoggies.find(({ hoggie: slug }) => slug === moment.hoggie);
  return `You opened ${name}'s pack${moment.newPerson ? ": new in your album" : ""}, with ${hoggie?.name ?? "a hoggie"} inside.`;
}
