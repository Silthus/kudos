// PROTOTYPE (#625, round 4): hoggies layout B, the display cabinet: your rarest finds lit on a shelf, a rarity strip, and a compact checklist below; a drawer slides in with the details. Never merge to main.
import { useState } from "react";
import { HoggieArt } from "../../../art";
import { useAlbum, type Album, type Hoggie } from "../../../round-3/album";
import { CloseButton, HoggieDetail, ModalDialog, ProgressBar } from "./HoggieDetail";
import { copiesWords, foundIn, hoggieLabel, isFound, latestFind, mostCopies, numberOf, rarestFinds, rarityTint, rarityWords, shelvesOf, shortDateWords, useChosenHoggie, type Shelf } from "./shelf";

const onDisplay = 5;

const filters = {
  all: { words: "All", keeps: () => true, none: "No hoggies in the album yet." },
  found: { words: "Found", keeps: isFound, none: "Nothing found yet. Open a pack and its hoggie lands here." },
  hidden: { words: "Still hidden", keeps: (hoggie: Hoggie) => !isFound(hoggie), none: "Every hoggie found. The whole cabinet is yours." },
  spares: { words: "Spares", keeps: (hoggie: Hoggie) => hoggie.count > 1, none: "No spares yet. They show up once a pack rolls a hoggie you already have." },
} satisfies Record<string, { words: string; keeps: (hoggie: Hoggie) => boolean; none: string }>;

type Filter = keyof typeof filters;

export function DisplayCabinet() {
  const { album } = useAlbum();
  const { chosen, choose, close } = useChosenHoggie(album.hoggies);
  return (
    <article className="r4h r4h-cabinet" aria-labelledby="r4h-cabinet-title">
      <header className="r4h-head">
        <p className="r4h-eyebrow">Surprises · Display cabinet</p>
        <h1 id="r4h-cabinet-title" className="r4h-title">
          Hoggies
        </h1>
        <p className="r4h-lede">Your rarest finds, on display. Every pack rolls one more.</p>
      </header>
      <Cabinet album={album} onChoose={choose} />
      <RarityStrip shelves={shelvesOf(album.hoggies)} />
      <Checklist album={album} onChoose={choose} />
      {chosen !== null && <Drawer hoggie={chosen} album={album} onClose={close} />}
    </article>
  );
}

function Cabinet({ album, onChoose }: { album: Album; onChoose: (hoggie: Hoggie) => void }) {
  const finds = rarestFinds(album.hoggies, onDisplay);
  return (
    <section className="r4h-case" aria-label="On display">
      <div className="r4h-glass">
        <p className="r4h-glass-label">
          <strong>Rarest finds</strong>
          <span>The top shelf fills itself</span>
        </p>
        <ul className="r4h-plinths">
          {finds.map((hoggie) => (
            <li key={hoggie.hoggie}>
              <Plinth hoggie={hoggie} onChoose={onChoose} />
            </li>
          ))}
        </ul>
      </div>
      <CabinetNotes album={album} onChoose={onChoose} />
    </section>
  );
}

function Plinth({ hoggie, onChoose }: { hoggie: Hoggie; onChoose: (hoggie: Hoggie) => void }) {
  return (
    <button type="button" className="r4h-plinth" style={rarityTint(hoggie.rarity)} aria-label={hoggieLabel(hoggie)} onClick={() => onChoose(hoggie)}>
      <span className="r4h-plinth-glow">
        <HoggieArt slug={hoggie.hoggie} size={96} />
      </span>
      <span className="r4h-plinth-name">{hoggie.name}</span>
      <span className="r4h-plinth-rarity">{rarityWords[hoggie.rarity]}</span>
      <span className="r4h-plinth-base" />
    </button>
  );
}

function CabinetNotes({ album, onChoose }: { album: Album; onChoose: (hoggie: Hoggie) => void }) {
  const latest = latestFind(album.hoggies);
  const copies = mostCopies(album.hoggies);
  return (
    <div className="r4h-notes">
      <div className="r4h-note">
        <span className="r4h-note-total">{foundIn(album.hoggies)}</span>
        <span className="r4h-note-words">
          <strong>of {album.hoggies.length} found</strong>
          <span className="r4h-quiet">{album.hoggies.length - foundIn(album.hoggies)} still hidden</span>
        </span>
      </div>
      {latest !== null && <NoteAbout hoggie={latest} heading="Latest find" detail={shortDateWords(latest.firstAt!)} onChoose={onChoose} />}
      {copies !== null && copies.count > 1 && <NoteAbout hoggie={copies} heading="Most copies" detail={copiesWords(copies.count)} onChoose={onChoose} />}
    </div>
  );
}

function NoteAbout({ hoggie, heading, detail, onChoose }: { hoggie: Hoggie; heading: string; detail: string; onChoose: (hoggie: Hoggie) => void }) {
  return (
    <button type="button" className="r4h-note" onClick={() => onChoose(hoggie)}>
      <HoggieArt slug={hoggie.hoggie} size={48} />
      <span className="r4h-note-words">
        <span className="r4h-quiet">{heading}</span>
        <strong>{hoggie.name}</strong>
        <span className="r4h-quiet">{detail}</span>
      </span>
    </button>
  );
}

function RarityStrip({ shelves }: { shelves: Shelf[] }) {
  return (
    <section className="r4h-strip" aria-label="Found by rarity">
      {shelves.map((shelf) => (
        <div key={shelf.rarity} className="r4h-strip-part" style={{ ...rarityTint(shelf.rarity), flex: `${shelf.hoggies.length} 1 0` }}>
          <ProgressBar part={shelf.found} whole={shelf.hoggies.length} />
          <span className="r4h-strip-words">
            <strong>{rarityWords[shelf.rarity]}</strong>
            <span>
              {shelf.found}/{shelf.hoggies.length}
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}

function Checklist({ album, onChoose }: { album: Album; onChoose: (hoggie: Hoggie) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const kept = album.hoggies.filter(filters[filter].keeps);
  const shelves = shelvesOf(kept).filter(({ hoggies }) => hoggies.length > 0);
  return (
    <section className="r4h-checklist" aria-labelledby="r4h-checklist-title">
      <div className="r4h-checklist-head">
        <h2 id="r4h-checklist-title" className="r4h-checklist-title">
          Checklist
        </h2>
        <div className="r4h-filters" role="group" aria-label="Show">
          {(Object.keys(filters) as Filter[]).map((key) => (
            <button key={key} type="button" className="r4h-filter" aria-pressed={key === filter} onClick={() => setFilter(key)}>
              {filters[key].words}
              <small>{album.hoggies.filter(filters[key].keeps).length}</small>
            </button>
          ))}
        </div>
      </div>
      {shelves.length === 0 && <p className="r4h-nothing">{filters[filter].none}</p>}
      {shelves.map((shelf) => (
        <CheckGroup key={shelf.rarity} shelf={shelf} album={album} onChoose={onChoose} />
      ))}
    </section>
  );
}

function CheckGroup({ shelf, album, onChoose }: { shelf: Shelf; album: Album; onChoose: (hoggie: Hoggie) => void }) {
  const whole = album.hoggies.filter(({ rarity }) => rarity === shelf.rarity);
  return (
    <div className="r4h-check-group" style={rarityTint(shelf.rarity)}>
      <h3 className="r4h-check-group-name">
        {rarityWords[shelf.rarity]}
        <small>
          {foundIn(whole)} of {whole.length}
        </small>
      </h3>
      <ul className="r4h-checks">
        {shelf.hoggies.map((hoggie) => (
          <li key={hoggie.hoggie}>
            <CheckRow hoggie={hoggie} number={numberOf(hoggie, album.hoggies)} onChoose={onChoose} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckRow({ hoggie, number, onChoose }: { hoggie: Hoggie; number: string; onChoose: (hoggie: Hoggie) => void }) {
  const found = isFound(hoggie);
  return (
    <button type="button" className={`r4h-check ${found ? "r4h-check-found" : "r4h-check-hidden"}`} aria-label={hoggieLabel(hoggie)} onClick={() => onChoose(hoggie)}>
      <span className="r4h-check-box" aria-hidden="true">
        {found ? "✓" : ""}
      </span>
      <HoggieArt slug={hoggie.hoggie} size={28} silhouette={!found} />
      <span className="r4h-check-name">{found ? hoggie.name : number}</span>
      {hoggie.count > 1 && <span className="r4h-copies">×{hoggie.count}</span>}
    </button>
  );
}

function Drawer({ hoggie, album, onClose }: { hoggie: Hoggie; album: Album; onClose: () => void }) {
  return (
    <ModalDialog className="r4h-drawer" labelledBy="r4h-drawer-title" onClose={onClose}>
      <div className="r4h-drawer-inner" style={rarityTint(hoggie.rarity)}>
        <div className="r4h-drawer-top">
          <span className="r4h-eyebrow">From the cabinet</span>
          <CloseButton onClose={onClose} label="Close the details" />
        </div>
        <HoggieDetail hoggie={hoggie} album={album} artSize={220} titleId="r4h-drawer-title" />
      </div>
    </ModalDialog>
  );
}
