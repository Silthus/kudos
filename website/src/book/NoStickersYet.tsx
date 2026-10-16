import { HedgehogHandClasp } from "../hoggies";
import { SlackLink } from "../SlackLink";

export function NoStickersYet({ chatUrl }: { chatUrl: string }) {
  return (
    <div data-no-stickers className="flex flex-col items-center gap-3 rounded-lg border bg-card px-4 py-8 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
      <HedgehogHandClasp size={88} className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col items-center gap-3 sm:items-start">
        <p className="text-sm text-muted-foreground">No stickers yet. Thank a teammate in Slack, or get thanked, and their sticker lands here.</p>
        <SlackLink chatUrl={chatUrl} variant="outline">
          Thank someone in Slack
        </SlackLink>
      </div>
    </div>
  );
}
