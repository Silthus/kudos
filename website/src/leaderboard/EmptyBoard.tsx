import { HedgehogTownCrier } from "@posthog/brand/hoggies";
import type { Leaderboard } from "../leaderboardFixtures";
import { PageTitle } from "../PageTitle";
import { ThankInSlack } from "./ThankInSlack";

export function EmptyBoard({ board }: { board: Leaderboard }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <HedgehogTownCrier size={96} title="" />
      <PageTitle tab="Leaderboard">Nobody is on this board yet.</PageTitle>
      <ThankInSlack chatUrl={board.chatUrl} variant="primary" />
    </div>
  );
}
