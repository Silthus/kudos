import { getComponentName } from "@posthog/brand";
import * as pictures from "@posthog/brand/crests/full/png";
import type { CrestArt } from "./drops";
import "./teamCrest.css";

const bySlug = pictures as unknown as Record<string, string | undefined>;

export function crestPictureOf({ slug }: CrestArt): string | undefined {
  const component = getComponentName("crests", slug);
  return bySlug[`${component.charAt(0).toLowerCase()}${component.slice(1)}Png`];
}

type TeamCrestProps = { art: CrestArt; size: number; collected?: boolean };

export function TeamCrest({ art, size, collected = true }: TeamCrestProps) {
  const picture = crestPictureOf(art);
  return (
    <span aria-hidden="true" data-crest-art={collected ? "collected" : "missing"} className={`team-crest ${collected ? "" : "team-crest-missing"}`} style={{ width: size, height: size }}>
      {picture !== undefined && <img src={picture} alt="" width={size} height={size} draggable={false} />}
    </span>
  );
}
