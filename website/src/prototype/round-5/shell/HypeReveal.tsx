// PROTOTYPE (#625, round 6): the small extra reveal under a person card in the pack opening: their hype emoji, unlocked by your first thank-you. Never merge to main.
import type { Album, Emoji } from "../../round-3/album";
import { EmojiArt } from "./EmojiArt";
import "./emoji.css";

export function HypeReveal({ album, emoji }: { album: Album; emoji: Emoji }) {
  return (
    <span className="r6s-hype" role="status">
      <EmojiArt album={album} emoji={{ ...emoji, unlocked: true }} size={28} />
      <span>
        + <span className="r6s-hype-name">{emoji.name}</span> unlocked
      </span>
    </span>
  );
}
