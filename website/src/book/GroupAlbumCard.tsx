import { useId } from "react";
import type { AlbumPerson, GroupAlbum } from "../collectionRead";
import { YouLabel } from "../leaderboard/BoardFace";
import { albumWordsOf } from "./albums";
import { QuietBar } from "./Bar";
import { PersonSilhouette } from "./PersonSilhouette";
import { StickerFace } from "./StickerTile";

export function GroupAlbumCard({ album }: { album: GroupAlbum }) {
  const headingId = useId();
  return (
    <li data-album={album.group} aria-labelledby={headingId} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-2">
          <h3 id={headingId} className="hud-display truncate text-lg font-bold leading-tight">
            {album.name}
          </h3>
          {album.mine && <YouLabel>Your group</YouLabel>}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{`${album.held} of ${album.total}`}</span>
      </div>
      <QuietBar value={album.held} max={album.total} />
      {album.people.length === 0 ? <p className="text-sm text-muted-foreground">No one else in this group yet.</p> : <People people={album.people} />}
    </li>
  );
}

function People({ people }: { people: AlbumPerson[] }) {
  return (
    <>
      <ul aria-hidden="true" className="flex flex-wrap gap-1.5">
        {people.map((person) => (
          <li key={person.key} data-album-person={person.key} data-held={person.held ? "held" : "missing"} title={person.name}>
            {person.held ? <StickerFace sticker={person} className="size-9" /> : <PersonSilhouette className="size-9" />}
          </li>
        ))}
      </ul>
      <span className="sr-only">{albumWordsOf(people)}</span>
    </>
  );
}
