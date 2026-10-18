// PROTOTYPE (#625, round 3): the corner pages: trophy case, leaderboard, activity and settings. Never merge to main.
import type { ReactNode } from "react";
import { AchievementEmblem, HoggieArt, MemberFace, TierMedal } from "../../art";
import { AppLink } from "../../../AppLink";
import { personOf, type Album, type Moment } from "../album";
import { shortDate } from "./motion";

export function SecondaryPage({ title, lead, children }: { title: string | null; lead: string | null; children: ReactNode }) {
  return (
    <div className="pb-secondary">
      <header className="pb-secondary-head">
        <AppLink href="/book" className="pb-link-button">
          ← Binder
        </AppLink>
        {title !== null && <h1 className="pb-title">{title}</h1>}
        {lead !== null && <p className="pb-home-lead">{lead}</p>}
      </header>
      <div className="pb-secondary-body">{children}</div>
    </div>
  );
}

export function TrophyCase({ album }: { album: Album }) {
  return (
    <SecondaryPage title="Milestones" lead="Album milestones, from your first face to every page.">
      <ul className="pb-trophies">
        {album.milestones.map((milestone) => {
          const earned = milestone.tiers.filter(({ earnedAt }) => earnedAt !== null);
          const best = earned.at(-1) ?? null;
          const next = milestone.tiers.find(({ earnedAt }) => earnedAt === null);
          return (
            <li key={milestone.id} className="pb-trophy">
              <span className="pb-trophy-plinth">
                <AchievementEmblem ladder={milestone.emblem} best={best?.tier ?? null} size={104} />
              </span>
              <span className="pb-trophy-name">{milestone.name}</span>
              <span className="pb-trophy-best">{best === null ? "Not started" : best.name}</span>
              <span className="pb-trophy-medals" aria-label={`${earned.length} of ${milestone.tiers.length} tiers`}>
                {milestone.tiers.map((tier) => (
                  <span key={tier.tier} title={`${tier.name}: ${tier.at} ${milestone.counts}`}>
                    <TierMedal tier={tier.tier} earned={tier.earnedAt !== null} size={22} />
                  </span>
                ))}
              </span>
              <span className="pb-trophy-count">{next === undefined ? `${milestone.count} ${milestone.counts}` : `${milestone.count} of ${next.at} ${milestone.counts}`}</span>
            </li>
          );
        })}
      </ul>
    </SecondaryPage>
  );
}

export function Leaderboard({ album }: { album: Album }) {
  return (
    <SecondaryPage title="Leaderboard" lead="Thoughtful kudos given this week: thank-yous that say why.">
      <ol className="pb-board">
        {album.board.map((row) => (
          <li key={row.name} data-you={row.you ? "" : undefined}>
            <span className="pb-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="pb-board-face" />
            <span className="pb-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="pb-board-count">{row.thoughtful}</span>
          </li>
        ))}
      </ol>
    </SecondaryPage>
  );
}

export function Activity({ album }: { album: Album }) {
  return (
    <SecondaryPage title="Activity" lead="Your recent thank-yous, hugs and packs.">
      <ul className="pb-activity">
        {album.moments.map((moment, index) => (
          <li key={`${moment.kind}-${moment.at}-${index}`}>
            <MomentLine album={album} moment={moment} />
            <span className="pb-activity-when">{shortDate(moment.at)}</span>
          </li>
        ))}
      </ul>
    </SecondaryPage>
  );
}

function MomentLine({ album, moment }: { album: Album; moment: Moment }) {
  const person = personOf(album, moment.person);
  const name = person?.name ?? "A teammate";
  const link = <AppLink href={`/book#people/${moment.person}`}>{name}</AppLink>;
  if (moment.kind === "thoughtful-given")
    return (
      <span className="pb-activity-line">
        You thanked {link}
        {moment.packed ? " · pack earned" : ""}
        <q>{moment.message}</q>
      </span>
    );
  if (moment.kind === "thoughtful-received")
    return (
      <span className="pb-activity-line">
        {link} thanked you<q>{moment.message}</q>
      </span>
    );
  if (moment.kind === "hug-given") return <span className="pb-activity-line">You hugged {link}</span>;
  if (moment.kind === "hug-received") return <span className="pb-activity-line">{link} hugged you</span>;
  const hoggie = album.hoggies.find(({ hoggie: slug }) => slug === moment.hoggie);
  return (
    <span className="pb-activity-line pb-activity-pack">
      <HoggieArt slug={moment.hoggie} size={28} />
      <span>
        You opened {link}'s pack{moment.newPerson ? ": new card" : ""} · {hoggie?.name ?? "a hoggie"}
      </span>
    </span>
  );
}

export function Settings({ page }: { page: ReactNode }) {
  return (
    <SecondaryPage title={null} lead={null}>
      <div className="pb-settings">{page}</div>
    </SecondaryPage>
  );
}
