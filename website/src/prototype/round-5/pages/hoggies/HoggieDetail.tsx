// PROTOTYPE (#625, round 5): one hoggie up close: big art, number, name, rarity, first found, copies and odds. Never merge to main.
import { HoggieArt } from "../../../art";
import type { Album, Hoggie } from "../../../round-3/album";
import { copiesWords, dateWords, isFound, lastRolledFrom, numberOf, oddsWords, rarityTint, rarityWords } from "./shelf";

export function HoggieDetail({ hoggie, album, titleId }: { hoggie: Hoggie; album: Album; titleId: string }) {
  const found = isFound(hoggie);
  return (
    <div className={`r5h-detail ${found ? "" : "r5h-detail-hidden"}`} style={rarityTint(hoggie.rarity)}>
      <figure className="r5h-detail-art">
        <HoggieArt slug={hoggie.hoggie} size={200} silhouette={!found} />
      </figure>
      <div className="r5h-detail-words">
        <p className="r5h-detail-number">{numberOf(hoggie, album.hoggies)}</p>
        <h2 id={titleId} className="r5h-detail-name">
          {found ? hoggie.name : "Not found yet"}
        </h2>
        <span className="r5h-pill">{rarityWords[hoggie.rarity]}</span>
        {found ? <FoundFacts hoggie={hoggie} album={album} /> : <StillHidden hoggie={hoggie} album={album} />}
      </div>
    </div>
  );
}

function FoundFacts({ hoggie, album }: { hoggie: Hoggie; album: Album }) {
  const rolledFrom = lastRolledFrom(album, hoggie);
  return (
    <dl className="r5h-facts">
      <dt>First found</dt>
      <dd>{dateWords(hoggie.firstAt!)}</dd>
      <dt>Copies</dt>
      <dd>{copiesWords(hoggie.count)}</dd>
      {rolledFrom !== null && (
        <>
          <dt>Last rolled</dt>
          <dd>In {rolledFrom}'s pack</dd>
        </>
      )}
      <dt>Odds</dt>
      <dd>{oddsWords(hoggie, album.hoggies)}</dd>
    </dl>
  );
}

function StillHidden({ hoggie, album }: { hoggie: Hoggie; album: Album }) {
  return (
    <>
      <p className="r5h-hint">Still out there. Every thoughtful kudos you give can earn a pack, and every pack rolls one hoggie.</p>
      <dl className="r5h-facts">
        <dt>Odds</dt>
        <dd>{oddsWords(hoggie, album.hoggies)}</dd>
      </dl>
    </>
  );
}

export function ProgressBar({ part, whole }: { part: number; whole: number }) {
  return (
    <span className="r5h-bar" role="presentation">
      <span style={{ width: `${(100 * part) / Math.max(1, whole)}%` }} />
    </span>
  );
}
