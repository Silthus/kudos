import type { CSSProperties } from "react";
import { hoggiePictureOf } from "../crates/Hoggie";

export function HoggieArt({ hoggie, hidden }: { hoggie: string; hidden: boolean }) {
  const picture = hoggiePictureOf({ kind: "hoggie", slug: hoggie });
  if (picture === undefined) return <span className="al-hoggie-art al-hoggie-art-unknown" aria-hidden="true" />;
  if (hidden) return <span className="al-hoggie-art al-hoggie-silhouette" data-silhouette="" aria-hidden="true" style={{ "--al-art": `url("${picture}")` } as CSSProperties} />;
  return <img className="al-hoggie-art" src={picture} alt="" draggable={false} />;
}
