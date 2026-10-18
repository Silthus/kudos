// PROTOTYPE (#625, round 5): your rank this week, yours and your team's, with the same numbers as the leaderboard. Never merge to main.
import { AppLink } from "../../../../AppLink";
import { CrestArt } from "../../../art";
import type { Album } from "../../../round-3/album";
import { perPersonWords } from "../../../round-4/pages/leaderboard/board";
import { hrefs, myTeamOf, ordinalRank, standingOf, type Standing } from "./profile";

export function Rank({ album }: { album: Album }) {
  const standing = standingOf(album);
  const team = myTeamOf(album);
  return (
    <section className="r5p-rank" aria-labelledby="r5p-rank-title">
      <h2 id="r5p-rank-title" className="r5p-rank-label">
        This week's thoughtful kudos
      </h2>
      <YourPlace standing={standing} />
      <p className="r5p-rank-team">
        <CrestArt art={team.art} size={28} name={team.name} collected={team.held > 0} />
        <span>{teamWords(standing, team.name)}</span>
      </p>
      <AppLink href={hrefs.leaderboard} className="r5p-link">
        See the leaderboard →
      </AppLink>
    </section>
  );
}

function YourPlace({ standing }: { standing: Standing }) {
  if (standing.you === null) return <p className="r5p-rank-none">Give a thoughtful kudos to join this week's board.</p>;
  return (
    <>
      <p className="r5p-rank-number">
        <span className="r5p-rank-big">{ordinalRank(standing.you.rank)}</span>
        <span className="r5p-quiet"> of {standing.you.of} givers</span>
      </p>
      <p className="r5p-rank-sub">{yourWords(standing.you, standing.gap)}</p>
    </>
  );
}

function yourWords(you: NonNullable<Standing["you"]>, gap: Standing["gap"]) {
  const given = `${you.thoughtful} given${you.tied ? ", tied" : ""}.`;
  return gap === null ? `${given} Top of the board.` : `${given} ${gap.more} more to pass ${gap.name}.`;
}

function teamWords(standing: Standing, name: string) {
  if (standing.team === null) return `${name} isn't on the board yet.`;
  return `${name} is ${ordinalRank(standing.team.rank)} of ${standing.team.of} teams, ${perPersonWords(standing.team.perPerson)} per person.`;
}
