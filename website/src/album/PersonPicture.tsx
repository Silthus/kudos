import { MemberFace } from "../Face";
import type { Face } from "../shell";
import { Silhouette } from "./Silhouette";

type PersonPictureProps = { face: Face; name: string; collected: boolean; frame: string; className: string };

export function PersonPicture({ face, name, collected, frame, className }: PersonPictureProps) {
  return (
    <span className={frame} data-picture={collected ? "colour" : "grey"} aria-hidden="true">
      <MemberFace face={face} className={className} withoutPicture={collected ? undefined : <Silhouette name={name} />} />
    </span>
  );
}
