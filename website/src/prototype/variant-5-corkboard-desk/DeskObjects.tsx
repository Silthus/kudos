// PROTOTYPE (#625): the small things lying on the desk: team polaroids, the taped-up league table, the medal box, the letters, the settings note.
import type { CSSProperties } from "react";
import { HedgehogMailbox } from "../../hoggies";
import { CrestArt, MemberFace } from "../art";
import type { World } from "../world";

export function TeamPolaroids({ world, onOpenTeam }: { world: World; onOpenTeam: (team: string) => void }) {
  return (
    <section className="v5-polaroids" aria-label="Team pages">
      {world.teams.map((team, index) => (
        <button key={team.team} type="button" className={`v5-polaroid ${team.mine ? "v5-polaroid-mine" : ""}`} style={{ "--tilt": `${((index * 41) % 13) - 6}deg`, left: (index % 2) * 136 + (Math.floor(index / 2) % 2) * 8, top: Math.floor(index / 2) * 146 + (index % 2) * 18 } as CSSProperties} onClick={() => onOpenTeam(team.team)} aria-label={`${team.name} team page, ${team.held} of ${team.total} stickers`}>
          {team.mine && <span className="v5-tape v5-tape-corner" />}
          <span className="v5-polaroid-photo">
            <CrestArt art={team.art} size={62} name={team.name} collected={team.complete || team.crest !== null || team.held > 0} />
          </span>
          <span className="v5-polaroid-strip">
            <span className="v5-polaroid-name">{team.name}</span>
            <span className="v5-polaroid-count">
              {team.held}/{team.total} stickers
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}

export function TapedLeague({ world, onPickUp }: { world: World; onPickUp: () => void }) {
  const you = world.board.find((row) => row.you);
  return (
    <button type="button" className="v5-league" onClick={onPickUp} aria-label="Leaderboard">
      <span className="v5-tape v5-tape-top" />
      <span className="v5-league-title">League table · this week</span>
      <span className="v5-league-rows">
        {world.board.slice(0, 5).map((row) => (
          <span key={row.position} className={`v5-league-row ${row.you ? "v5-league-you" : ""}`}>
            <span>{row.rank}.</span>
            <span className="v5-league-name">{row.name}</span>
            <span>{row.kudos}</span>
          </span>
        ))}
      </span>
      {you !== undefined && <span className="v5-league-foot">You are #{you.rank}</span>}
    </button>
  );
}

export function MedalBox({ world, onPickUp }: { world: World; onPickUp: () => void }) {
  const earned = world.achievements.flatMap(({ tiers }) => tiers.filter(({ earnedAt }) => earnedAt !== null));
  return (
    <button type="button" className="v5-medal-box" onClick={onPickUp} aria-label={`Achievements, ${earned.length} medals`}>
      <span className="v5-medal-box-lid">Medals</span>
      <span className="v5-medal-box-inside">
        {earned.slice(0, 6).map(({ tier }, index) => (
          <span key={index} className={`v5-medal v5-medal-${tier}`} />
        ))}
      </span>
      <span className="v5-object-caption">{earned.length} achievements</span>
    </button>
  );
}

export function LetterStack({ world, onPickUp }: { world: World; onPickUp: () => void }) {
  const latest = world.received[0];
  return (
    <button type="button" className="v5-letters" onClick={onPickUp} aria-label="Activity">
      <span className="v5-letter v5-letter-under" />
      <span className="v5-letter v5-letter-mid" />
      <span className="v5-letter v5-letter-top">
        <HedgehogMailbox size={42} />
        {latest !== undefined && (
          <span className="v5-letter-from">
            <MemberFace face={latest.giver.face} className="v5-letter-face" />
            from {latest.giver.name.split(" ")[0]}
          </span>
        )}
      </span>
      <span className="v5-object-caption">Activity</span>
    </button>
  );
}

export function SettingsNote({ onPickUp }: { onPickUp: () => void }) {
  return (
    <button type="button" className="v5-settings-note" onClick={onPickUp}>
      <span className="v5-settings-gear" aria-hidden="true">
        ⚙
      </span>
      Settings
      <span className="v5-print-small">workspace and you</span>
    </button>
  );
}
