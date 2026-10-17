import { getComponentName } from "@posthog/brand";
import * as pictures from "@posthog/brand/crests/full/png";
import { usePictureFailure } from "../Face";
import type { CrestArt } from "./drops";
import "./teamCrest.css";

const bySlug = pictures as unknown as Record<string, string | undefined>;

export type TeamArt = CrestArt | { kind: "image"; url: string } | null;

export function crestPictureOf({ slug }: CrestArt): string | undefined {
  const component = getComponentName("crests", slug);
  return bySlug[`${component.charAt(0).toLowerCase()}${component.slice(1)}Png`];
}

type TeamCrestProps = { art: TeamArt; size: number; collected?: boolean; name?: string };

export function TeamCrest({ art, size, collected = true, name }: TeamCrestProps) {
  if (art?.kind === "crest") return <BrandCrest art={art} size={size} collected={collected} />;
  return <PictureCrest art={art} size={size} collected={collected} name={name} />;
}

function BrandCrest({ art, size, collected }: { art: CrestArt; size: number; collected: boolean }) {
  const picture = crestPictureOf(art);
  return (
    <span aria-hidden="true" data-crest-art={collected ? "collected" : "missing"} className={`team-crest ${collected ? "" : "team-crest-missing"}`} style={{ width: size, height: size }}>
      {picture !== undefined && <img src={picture} alt="" width={size} height={size} draggable={false} />}
    </span>
  );
}

function PictureCrest({ art, size, collected, name }: { art: Exclude<TeamArt, CrestArt>; size: number; collected: boolean; name: string | undefined }) {
  const { failed, picture, onError } = usePictureFailure();
  const drawn = art !== null && !failed;
  return (
    <span aria-hidden="true" data-crest-art={collected ? "collected" : "missing"} data-crest-kind={drawn ? "image" : "default"} className={`team-crest ${collected ? "" : "team-crest-missing"}`} style={{ width: size, height: size }}>
      {drawn ? <img ref={picture} key={art.url} src={art.url} alt="" width={size} height={size} draggable={false} onError={onError} /> : <DefaultCrest initial={initialOf(name)} />}
    </span>
  );
}

function initialOf(name: string | undefined) {
  return name?.match(/\p{L}/u)?.[0]?.toUpperCase() ?? "";
}

function DefaultCrest({ initial }: { initial: string }) {
  return (
    <svg viewBox="0 0 64 64" className="team-crest-default size-full">
      <path d="M32 4 56 13v22c0 11-11 19-24 25C19 54 8 46 8 35V13z" fill="currentColor" opacity="0.14" />
      <path d="M32 4 56 13v22c0 11-11 19-24 25C19 54 8 46 8 35V13z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <text x="32" y="40" textAnchor="middle" fontSize="26" fontWeight="700" fill="currentColor" fontFamily="inherit">
        {initial}
      </text>
    </svg>
  );
}
