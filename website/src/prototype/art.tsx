// PROTOTYPE (#625): shared art for the five variants: real hoggies and crests from @posthog/brand (PNG exports). Never merge to main.
import { DropArtwork } from "../crates/Hoggie";
import { TeamCrest, type TeamArt } from "../crates/TeamCrest";

export { MemberFace } from "../Face";
export { DropArtwork };

export function HoggieArt({ slug, size, silhouette = false }: { slug: string; size: number; silhouette?: boolean }) {
  return <DropArtwork art={{ kind: "hoggie", slug }} size={size} silhouette={silhouette} />;
}

export function CrestArt({ art, size, name, collected = true }: { art: TeamArt; size: number; name?: string; collected?: boolean }) {
  return <TeamCrest art={art} size={size} name={name} collected={collected} />;
}
