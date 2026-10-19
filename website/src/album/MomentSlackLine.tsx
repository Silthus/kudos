import type { AlbumEmoji } from "./answer";
import { notInSlackYetWords, useItInSlackWords } from "./emojiShelf";

type MomentSlackLineProps = { emoji: AlbumEmoji; short: boolean; id?: string; className: string };

export function MomentSlackLine({ emoji, short, id, className }: MomentSlackLineProps) {
  return (
    <p id={id} className={className}>
      {emoji.inSlack ? (short ? "Use it in Slack" : useItInSlackWords) : notInSlackYetWords}
    </p>
  );
}
