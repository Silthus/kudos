import { hypeEmblemPicture } from "../../../convex/album/emojiCatalogue";
import type { AlbumEmoji } from "./answer";

type Pictured = Pick<AlbumEmoji, "kind" | "picture" | "from">;

export function EmojiPicture({ emoji, size, locked = false }: { emoji: Pictured; size: number; locked?: boolean }) {
  const faceless = isFacelessHype(emoji);
  return (
    <span className="al-emoji-art ph-no-capture" data-kind={emoji.kind} data-faceless={faceless ? "" : undefined} data-locked={locked ? "" : undefined} style={{ width: size, height: size }} aria-hidden="true">
      {faceless ? (
        <>
          <span className="al-emoji-initials" style={{ fontSize: Math.round(size * 0.36) }}>
            {initialsOf(emoji.from)}
          </span>
          <span className="al-emoji-star" />
        </>
      ) : (
        <img src={emoji.picture} alt="" width={size} height={size} loading="lazy" decoding="async" />
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
