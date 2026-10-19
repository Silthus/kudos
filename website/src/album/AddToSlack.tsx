import { hypeEmblemPicture, teamEmblemPicture } from "../../../convex/album/emojiCatalogue";
import type { AlbumEmoji } from "./answer";

export const slackCustomEmojiPage = "https://my.slack.com/customize/emoji";

export function AddToSlack({ emoji }: { emoji: AlbumEmoji }) {
  return (
    <a className="al-add-to-slack" href={slackCustomEmojiPage} target="_blank" rel="noreferrer" onClick={() => savePictureOf(emoji)}>
      Add to Slack
    </a>
  );
}

function savePictureOf(emoji: AlbumEmoji) {
  const save = document.createElement("a");
  save.setAttribute("href", downloadablePictureOf(emoji));
  save.download = `${emoji.name}.png`;
  save.click();
}

function downloadablePictureOf({ kind, picture }: AlbumEmoji) {
  if (isFromThisSite(picture)) return picture;
  return kind === "hype" ? hypeEmblemPicture : teamEmblemPicture;
}

function isFromThisSite(picture: string) {
  return new URL(picture, window.location.href).origin === window.location.origin;
}
