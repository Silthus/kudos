import { MemberFace } from "../Face";
import type { Face } from "../shell";
import { Silhouette } from "./Silhouette";

export function PersonPicture({ face, name, collected, className }: { face: Face; name: string; collected: boolean; className: string }) {
  return <MemberFace face={face} className={className} withoutPicture={collected ? undefined : <Silhouette name={name} />} />;
}

export function pictureShownOf(collected: boolean) {
  return collected ? "colour" : "grey";
}
