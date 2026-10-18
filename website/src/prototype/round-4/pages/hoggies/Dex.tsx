// PROTOTYPE (#625, round 4): hoggies layout C, the numbered dex: every hoggie has a number, a dense index on the left and a standing detail pane on the right to step through. Never merge to main.
import { useEffect, useState } from "react";
import { HoggieArt } from "../../../art";
import { useAlbum, type Album, type Hoggie } from "../../../round-3/album";
import { CloseButton, HoggieDetail, ProgressBar } from "./HoggieDetail";
import { foundIn, hoggieLabel, isFound, latestFind, numberOf, rarityTint, rarityWords, shelvesOf, shortDateWords, useChosenHoggie, type Rarity, type Shelf } from "./shelf";

export function Dex() {
  const { album } = useAlbum();
  const { chosen, choose, close } = useChosenHoggie(album.hoggies);
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const shown = album.hoggies.filter((hoggie) => rarity === null || hoggie.rarity === rarity);
  useChosenRowInView(chosen);
  return (
    <article className="r4h r4h-dex" aria-labelledby="r4h-dex-title">
      <header className="r4h-dex-head">
        <div className="r4h-head">
          <p className="r4h-eyebrow">Surprises · Numbered dex</p>
          <h1 id="r4h-dex-title" className="r4h-title">
            Hoggies
          </h1>
          <p className="r4h-lede">
            {album.hoggies.length} numbered hoggies. {foundIn(album.hoggies)} found so far.
          </p>
        </div>
        <RarityTabs album={album} rarity={rarity} onPick={setRarity} />
      </header>
      <div className="r4h-dex-body">
        <ol className="r4h-dex-list" aria-label="Every hoggie by number">
          {shown.map((hoggie) => (
            <li key={hoggie.hoggie}>
              <Row hoggie={hoggie} number={numberOf(hoggie, album.hoggies)} chosen={hoggie === chosen} onChoose={choose} />
            </li>
          ))}
        </ol>
        {chosen === null ? <Overview album={album} onChoose={choose} /> : <Pane hoggie={chosen} album={album} steps={shown.includes(chosen) ? shown : album.hoggies} onChoose={choose} onClose={close} />}
      </div>
    </article>
  );
}

function rowIdOf(hoggie: Hoggie) {
  return `r4h-row-${hoggie.hoggie}`;
}

function useChosenRowInView(chosen: Hoggie | null) {
  useEffect(() => {
    if (chosen !== null) document.getElementById(rowIdOf(chosen))?.scrollIntoView({ block: "nearest" });
  }, [chosen]);
}

function RarityTabs({ album, rarity, onPick }: { album: Album; rarity: Rarity | null; onPick: (rarity: Rarity | null) => void }) {
  const everything: Shelf = { rarity: "common", hoggies: album.hoggies, found: foundIn(album.hoggies), shareOfRolls: 100 };
  return (
    <div className="r4h-tabs" role="group" aria-label="Rarity">
      <Tab label="All" shelf={everything} picked={rarity === null} onPick={() => onPick(null)} />
      {shelvesOf(album.hoggies).map((shelf) => (
        <Tab key={shelf.rarity} label={rarityWords[shelf.rarity]} shelf={shelf} picked={rarity === shelf.rarity} tinted onPick={() => onPick(shelf.rarity)} />
      ))}
    </div>
  );
}

function Tab({ label, shelf, picked, tinted = false, onPick }: { label: string; shelf: Shelf; picked: boolean; tinted?: boolean; onPick: () => void }) {
  return (
    <button type="button" className="r4h-tab" aria-pressed={picked} style={tinted ? rarityTint(shelf.rarity) : undefined} onClick={onPick}>
      <span className="r4h-tab-top">
        {label}
        <small>
          {shelf.found}/{shelf.hoggies.length}
        </small>
      </span>
      <ProgressBar part={shelf.found} whole={shelf.hoggies.length} />
    </button>
  );
}

function Row({ hoggie, number, chosen, onChoose }: { hoggie: Hoggie; number: string; chosen: boolean; onChoose: (hoggie: Hoggie) => void }) {
  const found = isFound(hoggie);
  return (
    <button id={rowIdOf(hoggie)} type="button" className={`r4h-row ${found ? "" : "r4h-row-hidden"}`} style={rarityTint(hoggie.rarity)} aria-current={chosen || undefined} aria-label={`${number}, ${hoggieLabel(hoggie)}`} onClick={() => onChoose(hoggie)}>
      <span className="r4h-row-number">{number.replace("No. ", "#")}</span>
      <HoggieArt slug={hoggie.hoggie} size={36} silhouette={!found} />
      <span className="r4h-row-name">{found ? hoggie.name : "???"}</span>
      <span className="r4h-row-rarity">{rarityWords[hoggie.rarity]}</span>
      <span className="r4h-row-date">{found ? shortDateWords(hoggie.firstAt!) : ""}</span>
      <span className="r4h-row-copies">{hoggie.count > 1 && <span className="r4h-copies">×{hoggie.count}</span>}</span>
    </button>
  );
}

function Pane({ hoggie, album, steps, onChoose, onClose }: { hoggie: Hoggie; album: Album; steps: Hoggie[]; onChoose: (hoggie: Hoggie) => void; onClose: () => void }) {
  const at = steps.indexOf(hoggie);
  const previous = steps[at - 1];
  const next = steps[at + 1];
  return (
    <aside className="r4h-pane" style={rarityTint(hoggie.rarity)} aria-labelledby="r4h-pane-title">
      <div className="r4h-pane-top">
        <div className="r4h-pane-steps">
          <button type="button" className="r4h-step" disabled={previous === undefined} onClick={() => previous !== undefined && onChoose(previous)}>
            ← Previous
          </button>
          <button type="button" className="r4h-step" disabled={next === undefined} onClick={() => next !== undefined && onChoose(next)}>
            Next →
          </button>
        </div>
        <CloseButton onClose={onClose} label="Close the details" />
      </div>
      <HoggieDetail hoggie={hoggie} album={album} artSize={200} titleId="r4h-pane-title" />
    </aside>
  );
}

function Overview({ album, onChoose }: { album: Album; onChoose: (hoggie: Hoggie) => void }) {
  const latest = latestFind(album.hoggies);
  return (
    <aside className="r4h-pane r4h-pane-overview" aria-label="Your dex">
      <div className="r4h-overview">
        <p className="r4h-eyebrow">Your dex</p>
        <p className="r4h-overview-total">
          {foundIn(album.hoggies)} <small>/ {album.hoggies.length}</small>
        </p>
        <div className="r4h-overview-rows">
          {shelvesOf(album.hoggies).map((shelf) => (
            <div key={shelf.rarity} className="r4h-overview-row" style={rarityTint(shelf.rarity)}>
              <strong>{rarityWords[shelf.rarity]}</strong>
              <ProgressBar part={shelf.found} whole={shelf.hoggies.length} />
              <span>
                {shelf.found}/{shelf.hoggies.length}
              </span>
            </div>
          ))}
        </div>
        {latest !== null && (
          <button type="button" className="r4h-latest" onClick={() => onChoose(latest)}>
            <HoggieArt slug={latest.hoggie} size={48} />
            <span>
              <span className="r4h-quiet">Latest find · {numberOf(latest, album.hoggies)}</span>
              <strong>{latest.name}</strong>
            </span>
          </button>
        )}
        <p className="r4h-hint">Pick a number to see it up close.</p>
      </div>
    </aside>
  );
}
