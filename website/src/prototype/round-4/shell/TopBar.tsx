// PROTOTYPE (#625, round 4): the top bar: brand, XP bar, packs waiting, your name and the settings cog. Never merge to main.
import { AppLink } from "../../../AppLink";
import { MemberFace } from "../../art";
import { useAlbum } from "../../round-3/album";
import { packsHash, type Place } from "../address";

export function TopBar({ place }: { place: Place }) {
  const { album } = useAlbum();
  const here = place.kind === "team" && place.team === null ? "/" : window.location.pathname;
  return (
    <header className="r4-top">
      <AppLink href="/" className="r4-brand">
        HedgeHug
      </AppLink>
      <span className="r4-xp">
        Level {album.level.level} · <progress value={album.level.progress} max={1} /> {album.level.toNext} XP to {album.level.level + 1}
      </span>
      <AppLink href={`${here}${packsHash}`} className="r4-packs">
        {album.packs.length} packs
      </AppLink>
      <span className="r4-me">
        <MemberFace face={album.me.face} className="r4-me-face" />
        {album.me.name}
        <AppLink href="/settings" aria-label="Settings" className="r4-cog">
          ⚙
        </AppLink>
      </span>
    </header>
  );
}
