// PROTOTYPE (#625): rows shared by Home's lower deck and the Activity, Leaderboard and Achievements views. Never merge to main.
import type { KudosGiven, KudosReceived, LadderCard, LeaderboardRow } from "../../shell";
import { MemberFace } from "../art";
import type { World } from "../world";
import { dayOf, plainTextOf } from "./words";

export type Kudos = KudosReceived | KudosGiven;

export function recentKudos(world: World): Kudos[] {
  return [...world.received, ...world.given].toSorted((a, b) => b.at - a.at);
}

export function KudosRow({ entry }: { entry: Kudos }) {
  const received = entry.kind === "kudosReceived";
  const who = received ? entry.giver : (entry.recipients[0] ?? { name: "a teammate", face: { kind: "initials" as const, initials: "?" } });
  const headline = received ? `${entry.giver.name} thanked you` : `You thanked ${entry.recipients.map(({ name }) => name).join(", ")}`;
  return (
    <li className="v3-kudos">
      <MemberFace face={who.face} className="v3-face-sm" />
      <div className="v3-kudos-text">
        <p className="v3-kudos-head">
          <span>{headline}</span>
          <span className="v3-muted v3-num">{dayOf(entry.at)}</span>
        </p>
        <p className="v3-kudos-message">{plainTextOf(entry.message)}</p>
      </div>
    </li>
  );
}

export function BoardRow({ row }: { row: LeaderboardRow }) {
  return (
    <li className="v3-board-row" data-you={row.you || undefined}>
      <span className="v3-board-rank v3-num">{row.rank}</span>
      <MemberFace face={row.face} className="v3-face-sm" />
      <span className="v3-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
      <span className="v3-board-kudos v3-num">{row.kudos}</span>
    </li>
  );
}

export function boardSnippet(board: LeaderboardRow[]) {
  const top = board.slice(0, 3);
  const you = board.find((row) => row.you);
  return you === undefined || top.includes(you) ? top : [...top, you];
}

const tierColour = { bronze: "#A0662C", silver: "#7D838C", gold: "#B98A00", diamond: "#1E8FB5" } as const;

export function closestTiers(ladders: LadderCard[], count: number) {
  return ladders
    .filter((ladder) => ladder.next !== null)
    .toSorted((a, b) => a.next!.at - a.count - (b.next!.at - b.count))
    .slice(0, count);
}

export function LadderRow({ ladder }: { ladder: LadderCard }) {
  const nextTier = ladder.tiers.find(({ tier }) => tier === ladder.next?.tier);
  const share = ladder.next === null ? 1 : Math.min(1, ladder.count / ladder.next.at);
  return (
    <li className="v3-ladder">
      <div className="v3-ladder-head">
        <span className="v3-ladder-name">{ladder.name}</span>
        <span className="v3-medals" aria-label={`${ladder.tiers.filter(({ earnedAt }) => earnedAt !== null).length} of ${ladder.tiers.length} tiers earned`}>
          {ladder.tiers.map((tier) => (
            <span key={tier.tier} className="v3-medal" data-earned={tier.earnedAt !== null || undefined} style={{ background: tier.earnedAt !== null ? tierColour[tier.tier] : undefined }} title={tier.name} />
          ))}
        </span>
      </div>
      <span className="v3-mini-bar" aria-hidden="true">
        <span style={{ width: `${share * 100}%` }} />
      </span>
      <p className="v3-ladder-next">{ladder.next === null ? "Every tier earned" : `${ladder.count} of ${ladder.next.at} ${ladder.counts} · next: ${nextTier?.name ?? ladder.next.tier}`}</p>
    </li>
  );
}
