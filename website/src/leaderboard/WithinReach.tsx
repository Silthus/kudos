import type { WithinReach as Reachable } from "../../../convex/website/leaderboard";
import { plural } from "../album/facts";
import { firstNameOf } from "../album/teamPage";

type EmojiRow = { name: string; picture: string; what: string; how: string; have: number; need: number };

export function WithinReach({ reachable }: { reachable: Reachable }) {
  const rows = rowsOf(reachable);
  if (rows.length === 0) return null;
  return (
    <section className="lb-board" aria-label="Emojis within your reach">
      <h2 className="lb-board-title">Emojis within your reach</h2>
      <ul className="lb-reach">
        {rows.map((row) => (
          <li key={row.name} className="lb-reach-row">
            <img src={row.picture} alt="" width={32} height={32} className="lb-reach-picture" />
            <span className="lb-reach-words">
              <span className="lb-reach-what">
                {row.what} <code>:{row.name}:</code>
              </span>
              <span className="lb-row-note">{row.how}</span>
              {row.need > 1 && <Progress row={row} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function rowsOf({ hype, team, level }: Reachable): EmojiRow[] {
  const rows: EmojiRow[] = [];
  if (hype !== null) {
    const teammate = firstNameOf(hype.person.name);
    rows.push({ ...hype.emoji, ...hype.progress, what: `${teammate}'s hype emoji`, how: `Give ${teammate} a kudos` });
  }
  if (team !== null) {
    const toGo = team.progress.need - team.progress.have;
    rows.push({ ...team.emoji, ...team.progress, what: "Your team emoji", how: `Collect ${plural(toGo, `more ${team.teamName} sticker`, `more ${team.teamName} stickers`)}` });
  }
  if (level !== null) rows.push({ ...level.emoji, ...level.progress, what: `Level ${level.level} emoji`, how: `${level.progress.need - level.progress.have} XP to go: a hug a day gets you there` });
  return rows;
}

function Progress({ row: { what, have, need } }: { row: EmojiRow }) {
  return (
    <span className="lb-share" role="progressbar" aria-label={what} aria-valuemin={0} aria-valuemax={need} aria-valuenow={have}>
      <span className="lb-share-fill" style={{ width: `${Math.max(3, (have / need) * 100)}%` }} />
    </span>
  );
}
