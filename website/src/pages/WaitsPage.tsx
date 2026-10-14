import { AppLink } from "../AppLink";
import { MaxSays } from "../Max";
import { SlackLink } from "../SlackLink";

type Waits = { kind: "locked"; level: number } | { kind: "ready" };

export function WaitsPage({ name, waiting, chatUrl }: { name: string; waiting: Waits; chatUrl: string }) {
  return (
    <MaxSays title={name} tab={name} action={waiting.kind === "ready" ? <OpenSlack chatUrl={chatUrl} /> : <GoHome />}>
      {waiting.kind === "ready" ? `${name} is ready for you. Open it in Slack's App Home.` : `${name} opens at level ${waiting.level}.`}
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
