import { useId, useState, type ReactNode } from "react";
import { firstThankYouEmoji, mostKudosEmojiPicks } from "../../../convex/album/emojiCatalogue";
import type { Album, AlbumEmoji, PickKudosEmoji } from "./answer";
import { EmojiPicture } from "./EmojiPicture";
import { picksKudosEmojis, usableNowOf } from "./emojiShelf";

type PickerProps = { album: Album; pickKudosEmoji: PickKudosEmoji; Heading?: "h2" | "h3" };

export function KudosEmojiPicker({ album, pickKudosEmoji, Heading = "h2" }: PickerProps) {
  const heading = useId();
  const [replied, setReplied] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);
  const [readShown, setReadShown] = useState(album.kudosEmojiPicks);
  if (readShown !== album.kudosEmojiPicks) {
    setReadShown(album.kudosEmojiPicks);
    setReplied(null);
  }
  const pickable = usableNowOf(album.emojis).filter(({ id }) => id !== firstThankYouEmoji);
  if (!picksKudosEmojis(album) || pickable.length === 0) return null;
  const picked = new Set((replied ?? album.kudosEmojiPicks ?? []).filter((id) => pickable.some((emoji) => emoji.id === id)));
  const full = picked.size >= mostKudosEmojiPicks;
  const toggle = async ({ id }: AlbumEmoji) => {
    setSending(true);
    const reply = await pickKudosEmoji(id, !picked.has(id)).catch(() => null);
    if (reply?.kind === "picked") setReplied(reply.picks);
    setSending(false);
  };
  return (
    <section className="al-emoji-shelf" aria-labelledby={heading}>
      <Heading id={heading} className="al-emoji-panel-title">
        Count in kudos{" "}
        <span className="al-quiet">
          · {picked.size} of {mostKudosEmojiPicks}
        </span>
      </Heading>
      <p className="al-emoji-panel-hint">{alwaysCountingWords(album)} Pick up to {mostKudosEmojiPicks} more for the kudos you write. A teammate's hype emoji counts when you mention them, and a reaction with any emoji is a hug.</p>
      <ul className="al-kudos-picks">
        {pickable.map((emoji) => (
          <li key={emoji.id}>
            <button type="button" className="al-kudos-pick" aria-pressed={picked.has(emoji.id)} disabled={sending || (full && !picked.has(emoji.id))} onClick={() => void toggle(emoji)}>
              <EmojiPicture emoji={emoji} size={24} />
              <code className="al-emoji-code ph-no-capture">:{emoji.name}:</code>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function alwaysCountingWords({ emojis }: Album): ReactNode {
  const firstThankYou = emojis.find(({ id, earned }) => id === firstThankYouEmoji && earned);
  if (firstThankYou === undefined) return "Your kudos emoji always counts.";
  return (
    <>
      Your kudos emoji and <code className="al-emoji-code ph-no-capture">:{firstThankYou.name}:</code> always count.
    </>
  );
}
