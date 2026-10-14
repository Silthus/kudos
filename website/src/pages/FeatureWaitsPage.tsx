import { AppLink } from "../AppLink";
import { MaxSays } from "../Max";
import type { FeatureCard, PageWaits } from "../shell";
import { SlackLink } from "../SlackLink";
import { ReadyPage } from "./ReadyPage";

type FeatureWaitsPageProps = { name: string; waiting: PageWaits; readyCard: FeatureCard | undefined; chatUrl: string };

export function FeatureWaitsPage({ name, waiting, readyCard, chatUrl }: FeatureWaitsPageProps) {
  if (waiting.kind === "ready" && readyCard !== undefined) return <ReadyPage card={readyCard} />;
  return (
    <MaxSays title={name} tab={name} action={waiting.kind === "ready" ? <OpenSlack chatUrl={chatUrl} /> : <GoHome />}>
      {waiting.kind === "ready" ? readyInSlack(name) : `${name} opens at level ${waiting.level}.`}
    </MaxSays>
  );
}

export function readyInSlack(name: string) {
  return `${name} is ready for you. Open it in Slack's App Home.`;
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
      Back to your profile
    </AppLink>
  );
}
