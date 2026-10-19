import { Panel } from "../home/Panel";
import type { SharedEmoji } from "./answer";
import { SlackStatus } from "./EmojiPanel";
import { EmojiPicture } from "./EmojiPicture";
import { byKind, earnedFromWords } from "./emojiShelf";
import "./emoji.css";

export function SharedEmojis({ emojis, emojiPage }: { emojis: SharedEmoji[]; emojiPage: string | null }) {
  const inSlack = emojis.filter((emoji) => emoji.inSlack).length;
  return (
    <Panel id="shared-emojis" label="Shared emojis" aside={`${inSlack} of ${emojis.length} in Slack`}>
      <p className="text-sm text-muted-foreground">Every team, milestone and level emoji members can earn. Add the ones Slack doesn't have yet, under the names below, so members can react with them as soon as they earn them.</p>
      <ul className="al-emoji-rows">
        {emojis.toSorted(byKind).map((emoji) => (
          <li key={emoji.id} className="al-emoji-row">
            <EmojiPicture emoji={emoji} size={36} />
            <span className="al-emoji-words">
              <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>
              <span className="al-emoji-why">{earnedFromWords(emoji)}</span>
            </span>
            <SlackStatus emoji={emoji} emojiPage={emojiPage} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
