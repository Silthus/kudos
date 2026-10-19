import { hypeEmblemPicture } from "../../../convex/album/emojiCatalogue";
import type { AlbumEmoji } from "./answer";

type Pictured = Pick<AlbumEmoji, "kind" | "picture" | "from">;

export function EmojiPicture({ emoji, size, locked = false }: { emoji: Pictured; size: number; locked?: boolean }) {
  return (
    <span className="al-emoji-art ph-no-capture" data-kind={emoji.kind} data-locked={locked ? "" : undefined} style={{ width: size, height: size }} aria-hidden="true">
      <img src={emoji.picture} alt="" width={size} height={size} loading="lazy" decoding="async" />
      {isFacelessHype(emoji) && (
        <span className="al-emoji-initials" style={{ fontSize: Math.round(size * 0.34) }}>
          {initialsOf(emoji.from)}
        </span>
      )}
    </span>
  );
}

export function isFacelessHype({ kind, picture }: Pick<AlbumEmoji, "kind" | "picture">) {
  return kind === "hype" && picture === hypeEmblemPicture;
}

export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase() || "?";
}
