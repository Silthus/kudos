import { TeamCrest } from "../crates/TeamCrest";
import type { AlbumEmoji, AlbumTeam } from "./answer";

type TeamEmojiPictureProps = { art: AlbumTeam["art"]; name: string; emoji: AlbumEmoji | undefined; size: number };

export function TeamEmojiPicture({ art, name, emoji, size }: TeamEmojiPictureProps) {
  if (emoji?.inSlack) return <img src={emoji.picture} alt="" width={size} height={size} className="object-contain" />;
  return <TeamCrest art={art} size={size} name={name} />;
}
