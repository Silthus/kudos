import { HedgehogTownCrier } from "../hoggies";
import { PageTitle } from "../PageTitle";
import { SlackLink } from "../SlackLink";

export function EmptyBoard({ chatUrl, sentence = "Nobody is on this board yet." }: { chatUrl: string; sentence?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <HedgehogTownCrier size={96} />
      <PageTitle tab="Leaderboard">{sentence}</PageTitle>
      <SlackLink chatUrl={chatUrl} variant="primary">
        Thank someone in Slack
      </SlackLink>
    </div>
  );
}
