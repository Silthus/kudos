import { getComponentName } from "@posthog/brand";
import * as hoggies from "@posthog/brand/hoggies";
import type { Hoggie } from "../features";
import type { HoggieArt } from "./drops";

const bySlug = hoggies as unknown as Record<string, Hoggie | undefined>;

export function hoggieOf({ slug }: HoggieArt): Hoggie | undefined {
  return bySlug[getComponentName("hoggies", slug)];
}

export function DropArtwork({ art, size }: { art: HoggieArt; size: number }) {
  const Hog = hoggieOf(art);
  if (Hog === undefined) return <span aria-hidden="true" className="drop-art-unknown" style={{ width: size, height: size }} />;
  return <Hog size={size} title="" className="h-auto" />;
}
