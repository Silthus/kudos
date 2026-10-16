import { getComponentName } from "@posthog/brand";
import * as pictures from "@posthog/brand/hoggies/png";
import type { CSSProperties } from "react";
import type { HoggieArt } from "./drops";

const bySlug = pictures as unknown as Record<string, string | undefined>;

export function hoggiePictureOf({ slug }: HoggieArt): string | undefined {
  const component = getComponentName("hoggies", slug);
  const picture = `${component.charAt(0).toLowerCase()}${component.slice(1)}`;
  return bySlug[`${picture}Png`] ?? bySlug[`${picture}1Png`];
}

type DropArtworkProps = { art: HoggieArt; size: number; silhouette?: boolean };

export function DropArtwork({ art, size, silhouette = false }: DropArtworkProps) {
  const picture = hoggiePictureOf(art);
  if (picture === undefined) return <span aria-hidden="true" className="drop-art-unknown" style={{ width: size, height: size }} />;
  if (silhouette) return <span aria-hidden="true" data-silhouette-art className="drop-art-silhouette" style={{ width: size, height: size, "--art": `url("${picture}")` } as CSSProperties} />;
  return <img src={picture} alt="" width={size} draggable={false} className="h-auto" />;
}
