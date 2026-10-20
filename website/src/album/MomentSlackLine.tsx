import type { AlbumEmoji } from "./answer";
import { notInSlackYetWords, useItInSlackWords } from "./emojiShelf";
import { comingSoonToSlackWords, type SlackWay } from "./slackWay";
import { useSlackWay } from "./findInSlack";

type MomentSlackLineProps = { emoji: AlbumEmoji; short: boolean; id?: string; className: string };

export function MomentSlackLine({ emoji, short, id, className }: MomentSlackLineProps) {
  return (
    <p id={id} className={className}>
      {slackLineOf(emoji, short, useSlackWay())}
    </p>
  );
}

function slackLineOf({ inSlack }: AlbumEmoji, short: boolean, way: SlackWay) {
  if (inSlack) return short ? "Use it in Slack" : useItInSlackWords;
  return way === "coming-soon" ? comingSoonToSlackWords : notInSlackYetWords;
}
