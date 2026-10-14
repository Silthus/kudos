import { AppLink } from "../AppLink";
import { leaderboardWaitingWords } from "../leaderboard/waiting";
import { MaxSays } from "../Max";
import type { LeaderboardWaits } from "../shell";
import { SlackLink } from "../SlackLink";

export function LeaderboardWaitsPage({ waiting, chatUrl }: { waiting: LeaderboardWaits; chatUrl: string }) {
  return (
    <MaxSays title="Leaderboard" tab="Leaderboard" action={waiting.kind === "ready" ? <OpenSlack chatUrl={chatUrl} /> : <GoHome />}>
      {leaderboardWaitingWords(waiting)}
    </MaxSays>
  );
}

function OpenSlack({ chatUrl }: { chatUrl: string }) {
  return (
    <SlackLink chatUrl={chatUrl} variant="primary">
      Open Slack
    </SlackLink>
  );
}

function GoHome() {
  return (
    <AppLink href="/" className="text-sm font-medium underline underline-offset-4">
      Go to Home
    </AppLink>
  );
}
