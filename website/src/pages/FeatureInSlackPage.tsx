import { aboutOf } from "../features";
import { HogSays } from "../Max";
import type { FeatureCard } from "../shell";
import { SlackLink } from "../SlackLink";

export function FeatureInSlackPage({ card, chatUrl }: { card: FeatureCard; chatUrl: string }) {
  return (
    <HogSays
      Hog={aboutOf(card.feature).Hog}
      title={card.name}
      tab={card.name}
      action={
        <SlackLink chatUrl={chatUrl} variant="primary">
          Open Slack
        </SlackLink>
      }
    >
      {`${card.name} is open. Find it in Slack's App Home.`}
    </HogSays>
  );
}
