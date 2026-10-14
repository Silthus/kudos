import { IconExternal } from "@posthog/icons";
import { buttonVariants } from "@posthog/quill";
import { AppLink } from "../AppLink";
import { leaderboardIsReady, leaderboardOpensAt } from "../leaderboard/waiting";
import { MaxSays } from "../Max";

type Waiting = { kind: "locked"; level: number } | { kind: "ready" };

export function LeaderboardWaitsPage({ waiting, chatUrl }: { waiting: Waiting; chatUrl: string }) {
  return (
    <MaxSays title="Leaderboard" tab="Leaderboard" action={waiting.kind === "ready" ? <OpenSlack chatUrl={chatUrl} /> : <GoHome />}>
      {waiting.kind === "ready" ? leaderboardIsReady : leaderboardOpensAt(waiting.level)}
    </MaxSays>
  );
}

function OpenSlack({ chatUrl }: { chatUrl: string }) {
  return (
    <a href={chatUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "primary", size: "sm" })}>
      Open Slack <span className="sr-only">(opens in a new tab)</span>
      <IconExternal aria-hidden="true" className="size-4" />
    </a>
  );
}

function GoHome() {
  return (
    <AppLink href="/" className="text-sm font-medium underline underline-offset-4">
      Go to Home
    </AppLink>
  );
}
