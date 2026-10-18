// PROTOTYPE (#625, round 5): the top of the hoggies page: your rarest finds lit on a shelf, a few notes beside it, and the rarity strip. Never merge to main.
import { HoggieArt } from "../../../art";
import type { Album, Hoggie } from "../../../round-3/album";
import { ProgressBar } from "./HoggieDetail";
import { copiesWords, foundIn, hoggieLabel, latestFind, mostCopies, rarestFinds, rarityTint, rarityWords, shortDateWords, type Rarity, type Shelf } from "./shelf";

const onDisplay = 5;

type Choose = (hoggie: Hoggie) => void;

export function Showcase({ album, onChoose }: { album: Album; onChoose: Choose }) {
  return (
    <section className="r5h-case" aria-label="On display">
      <div className="r5h-glass">
        <p className="r5h-glass-label">
          <strong>Rarest finds</strong>
          <span>The top shelf fills itself</span>
        </p>
        <ul className="r5h-plinths">
          {rarestFinds(album.hoggies, onDisplay).map((hoggie) => (
            <li key={hoggie.hoggie}>
              <Plinth hoggie={hoggie} onChoose={onChoose} />
            </li>
          ))}
        </ul>
      </div>
      <Notes album={album} onChoose={onChoose} />
    </section>
  );
}

function Plinth({ hoggie, onChoose }: { hoggie: Hoggie; onChoose: Choose }) {
  return (
    <button type="button" className="r5h-plinth" style={rarityTint(hoggie.rarity)} aria-label={hoggieLabel(hoggie)} onClick={() => onChoose(hoggie)}>
      <span className="r5h-plinth-glow">
        <HoggieArt slug={hoggie.hoggie} size={96} />
      </span>
      <span className="r5h-plinth-name">{hoggie.name}</span>
      <span className="r5h-plinth-rarity">{rarityWords[hoggie.rarity]}</span>
      <span className="r5h-plinth-base" />
    </button>
  );
}

function Notes({ album, onChoose }: { album: Album; onChoose: Choose }) {
  const found = foundIn(album.hoggies);
  const latest = latestFind(album.hoggies);
  const copies = mostCopies(album.hoggies);
  return (
    <div className="r5h-notes">
      <div className="r5h-note">
        <span className="r5h-note-total">{found}</span>
        <span className="r5h-note-words">
          <strong>of {album.hoggies.length} found</strong>
          <span className="r5h-quiet">{album.hoggies.length - found} still hidden</span>
        </span>
      </div>
      {latest !== null && <NoteAbout hoggie={latest} heading="Latest find" detail={shortDateWords(latest.firstAt!)} onChoose={onChoose} />}
      {copies !== null && copies.count > 1 && <NoteAbout hoggie={copies} heading="Most copies" detail={copiesWords(copies.count)} onChoose={onChoose} />}
    </div>
  );
}

function NoteAbout({ hoggie, heading, detail, onChoose }: { hoggie: Hoggie; heading: string; detail: string; onChoose: Choose }) {
  return (
    <button type="button" className="r5h-note" onClick={() => onChoose(hoggie)}>
      <HoggieArt slug={hoggie.hoggie} size={48} />
      <span className="r5h-note-words">
        <span className="r5h-quiet">{heading}</span>
        <strong>{hoggie.name}</strong>
        <span className="r5h-quiet">{detail}</span>
      </span>
    </button>
  );
}

export function RarityStrip({ shelves, onJump }: { shelves: Shelf[]; onJump: (rarity: Rarity) => void }) {
  return (
    <nav className="r5h-strip" aria-label="Found by rarity">
      {shelves.map((shelf) => (
        <button key={shelf.rarity} type="button" className="r5h-strip-part" style={{ ...rarityTint(shelf.rarity), flex: `${shelf.hoggies.length} 1 0` }} aria-label={`${rarityWords[shelf.rarity]}: ${shelf.found} of ${shelf.hoggies.length} found. Jump there`} onClick={() => onJump(shelf.rarity)}>
          <ProgressBar part={shelf.found} whole={shelf.hoggies.length} />
          <span className="r5h-strip-words">
            <strong>{rarityWords[shelf.rarity]}</strong>
            <span>
              {shelf.found}/{shelf.hoggies.length}
            </span>
          </span>
        </button>
      ))}
    </nav>
  );
}
