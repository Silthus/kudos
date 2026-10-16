import type { CSSProperties } from "react";
import { hoggiePictureOf } from "./crates/Hoggie";
import { MemberFace, usePictureFailure } from "./Face";
import type { Avatar, Face } from "./shell";
import "./ownFace.css";

type OwnFaceProps = { face: Face; avatar: Avatar | null | undefined; className: string };

export function OwnFace({ face, avatar, className }: OwnFaceProps) {
  const picture = avatar == null ? undefined : hoggiePictureOf(avatar.art);
  if (avatar == null || picture === undefined) return <MemberFace face={face} className={className} />;
  return <AvatarHoggie key={avatar.hoggie} avatar={avatar} picture={picture} face={face} className={className} />;
}

type AvatarHoggieProps = { avatar: Avatar; picture: string; face: Face; className: string };

function AvatarHoggie({ avatar: { hoggie, rarity }, picture, face, className }: AvatarHoggieProps) {
  const art = usePictureFailure();
  if (art.failed) return <MemberFace face={face} className={className} />;
  return (
    <span data-avatar={hoggie} data-rarity={rarity} className={`own-avatar ${className}`} style={{ "--rarity": `var(--rarity-${rarity})` } as CSSProperties}>
      <img ref={art.picture} src={picture} alt="" draggable={false} onError={art.onError} />
    </span>
  );
}
