import { isOrAre, itOrThem, plainNameOf, type PagedFeature } from "../features";
import { MaxSays } from "../Max";
import { navEntriesOf } from "../nav/entries";
import type { Feature, MemberProfile, PageWaits } from "../shell";
import { SlackLink } from "../SlackLink";
import { LockedPage } from "./LockedPage";
import { ReadyPage } from "./ReadyPage";

type FeatureWaitsPageProps = { feature: PagedFeature; waiting: PageWaits; member: MemberProfile };

export function FeatureWaitsPage({ feature, waiting, member }: FeatureWaitsPageProps) {
  const entry = navEntriesOf(member).find((shown) => shown.state !== "open" && featureOf(shown) === feature);
  if (entry?.state === "ready") return <ReadyPage card={entry.card} member={member} />;
  if (entry?.state === "locked") return <LockedPage feature={feature} name={entry.name} level={entry.level} member={member} />;
  const name = plainNameOf(feature);
  if (waiting.kind === "locked") return <LockedPage feature={feature} name={name} level={waiting.level} member={member} />;
  return (
    <MaxSays title={name} tab={name} action={<OpenSlack chatUrl={member.chatUrl} />}>
      {readyInSlack(feature)}
    </MaxSays>
  );
}

function featureOf(entry: ReturnType<typeof navEntriesOf>[number]) {
  return entry.state === "ready" ? entry.card.feature : entry.feature;
}

export function readyInSlack(feature: Feature) {
  return `${plainNameOf(feature)} ${isOrAre(feature)} ready for you. Open ${itOrThem(feature)} in Slack's App Home.`;
}

function OpenSlack({ chatUrl }: { chatUrl: string }) {
  return (
    <SlackLink chatUrl={chatUrl} variant="primary">
      Open Slack
    </SlackLink>
  );
}
