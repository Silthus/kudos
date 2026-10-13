import { MemberFace } from "../Face";
import type { LeaderboardRow } from "../leaderboardFixtures";

export function BoardFace({ row, className }: { row: LeaderboardRow; className: string }) {
  if (!row.you) return <MemberFace face={row.face} className={className} />;
  return (
    <span data-you-ring className="inline-flex shrink-0 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-card">
      <MemberFace face={row.face} className={className} />
    </span>
  );
}

export function YouLabel() {
  return <span className="rounded-full border border-primary px-1.5 py-px text-[11px] font-medium leading-tight">You</span>;
}

export function RankWords({ row }: { row: LeaderboardRow }) {
  return <span className="sr-only">{`Rank ${row.rank}${row.tied ? ", tied" : ""}: `}</span>;
}
