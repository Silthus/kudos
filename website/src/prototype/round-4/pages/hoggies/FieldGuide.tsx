// PROTOTYPE (#625, round 4): hoggies layout A, the field guide: one chapter per rarity, common to legendary, each hoggie a plate, an entry card opens over the page. Never merge to main.
import { HoggieArt } from "../../../art";
import { useAlbum, type Album, type Hoggie } from "../../../round-3/album";
import { CloseButton, HoggieDetail, ModalDialog, ProgressBar } from "./HoggieDetail";
import { foundIn, hoggieLabel, isFound, numberOf, rarityTint, rarityWords, shelvesOf, useChosenHoggie, type Shelf } from "./shelf";

const romanNumerals = ["I", "II", "III", "IV", "V"];

export function FieldGuide() {
  const { album } = useAlbum();
  const { chosen, choose, close } = useChosenHoggie(album.hoggies);
  const shelves = shelvesOf(album.hoggies);
  return (
    <article className="r4h r4h-guide" aria-labelledby="r4h-guide-title">
      <header className="r4h-head">
        <p className="r4h-eyebrow">Surprises · Field guide</p>
        <h1 id="r4h-guide-title" className="r4h-title">
          Hoggies
        </h1>
        <p className="r4h-lede">
          Every pack rolls one hoggie. You've spotted {foundIn(album.hoggies)} of {album.hoggies.length}: five chapters, from the everyday commons to the six legendaries.
        </p>
      </header>
      <ChapterIndex shelves={shelves} />
      {shelves.map((shelf, index) => (
        <Chapter key={shelf.rarity} shelf={shelf} numeral={romanNumerals[index]!} album={album} onChoose={choose} />
      ))}
      {chosen !== null && <Entry hoggie={chosen} album={album} onClose={close} />}
    </article>
  );
}

function chapterId(shelf: Shelf) {
  return `r4h-chapter-${shelf.rarity}`;
}

function ChapterIndex({ shelves }: { shelves: Shelf[] }) {
  const jumpTo = (shelf: Shelf) => document.getElementById(chapterId(shelf))?.scrollIntoView({ block: "start" });
  return (
    <nav className="r4h-chapters" aria-label="Chapters">
      {shelves.map((shelf) => (
        <button key={shelf.rarity} type="button" className="r4h-chapter-link" style={rarityTint(shelf.rarity)} onClick={() => jumpTo(shelf)}>
          <span className="r4h-chapter-link-name">{rarityWords[shelf.rarity]}</span>
          <span className="r4h-chapter-link-count">
            {shelf.found} <small>of {shelf.hoggies.length}</small>
          </span>
          <ProgressBar part={shelf.found} whole={shelf.hoggies.length} />
          <span className="r4h-chapter-link-odds">{shelf.shareOfRolls}% of rolls</span>
        </button>
      ))}
    </nav>
  );
}

function Chapter({ shelf, numeral, album, onChoose }: { shelf: Shelf; numeral: string; album: Album; onChoose: (hoggie: Hoggie) => void }) {
  const titleId = `${chapterId(shelf)}-title`;
  return (
    <section id={chapterId(shelf)} className="r4h-chapter" style={rarityTint(shelf.rarity)} aria-labelledby={titleId}>
      <div className="r4h-chapter-head">
        <span className="r4h-chapter-numeral">Chapter {numeral}</span>
        <h2 id={titleId} className="r4h-chapter-title">
          {rarityWords[shelf.rarity]}
        </h2>
        <p className="r4h-chapter-about">
          {shelf.found} of {shelf.hoggies.length} spotted · {shelf.shareOfRolls}% of rolls land here
        </p>
        <ProgressBar part={shelf.found} whole={shelf.hoggies.length} />
      </div>
      <ul className="r4h-plates">
        {shelf.hoggies.map((hoggie) => (
          <li key={hoggie.hoggie}>
            <Plate hoggie={hoggie} number={numberOf(hoggie, album.hoggies)} onChoose={onChoose} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Plate({ hoggie, number, onChoose }: { hoggie: Hoggie; number: string; onChoose: (hoggie: Hoggie) => void }) {
  const found = isFound(hoggie);
  return (
    <button type="button" className={`r4h-plate ${found ? "" : "r4h-plate-hidden"}`} aria-label={hoggieLabel(hoggie)} onClick={() => onChoose(hoggie)}>
      <HoggieArt slug={hoggie.hoggie} size={72} silhouette={!found} />
      <span className="r4h-plate-name">{found ? hoggie.name : number}</span>
      {hoggie.count > 1 && <span className="r4h-copies">×{hoggie.count}</span>}
    </button>
  );
}

function Entry({ hoggie, album, onClose }: { hoggie: Hoggie; album: Album; onClose: () => void }) {
  return (
    <ModalDialog className="r4h-entry" labelledBy="r4h-entry-title" onClose={onClose}>
      <div className="r4h-entry-inner" style={rarityTint(hoggie.rarity)}>
        <div className="r4h-entry-top">
          <span className="r4h-eyebrow">Field guide entry</span>
          <CloseButton onClose={onClose} label="Close the entry" />
        </div>
        <HoggieDetail hoggie={hoggie} album={album} titleId="r4h-entry-title" />
      </div>
    </ModalDialog>
  );
}
