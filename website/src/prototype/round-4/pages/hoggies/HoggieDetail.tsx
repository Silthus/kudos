// PROTOTYPE (#625, round 4): one hoggie up close: big art, number, name, rarity, first found, copies and odds. Every hoggies layout frames it its own way. Never merge to main.
import { useEffect, useRef, type ReactNode } from "react";
import { HoggieArt } from "../../../art";
import type { Album, Hoggie } from "../../../round-3/album";
import { copiesWords, dateWords, isFound, lastRolledFrom, numberOf, oddsWords, rarityTint, rarityWords } from "./shelf";

export function HoggieDetail({ hoggie, album, artSize = 180, titleId }: { hoggie: Hoggie; album: Album; artSize?: number; titleId?: string }) {
  const found = isFound(hoggie);
  return (
    <div className={`r4h-detail ${found ? "" : "r4h-detail-hidden"}`} style={rarityTint(hoggie.rarity)}>
      <figure className="r4h-detail-art">
        <HoggieArt slug={hoggie.hoggie} size={artSize} silhouette={!found} />
      </figure>
      <div className="r4h-detail-words">
        <p className="r4h-detail-number">{numberOf(hoggie, album.hoggies)}</p>
        <h2 id={titleId} className="r4h-detail-name">
          {found ? hoggie.name : "Not found yet"}
        </h2>
        <span className="r4h-pill">{rarityWords[hoggie.rarity]}</span>
        {found ? <FoundFacts hoggie={hoggie} album={album} /> : <StillHidden hoggie={hoggie} album={album} />}
      </div>
    </div>
  );
}

function FoundFacts({ hoggie, album }: { hoggie: Hoggie; album: Album }) {
  const rolledFrom = lastRolledFrom(album, hoggie);
  return (
    <dl className="r4h-facts">
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
      <p className="r4h-hint">Still out there. Every thoughtful kudos you give can earn a pack, and every pack rolls one hoggie.</p>
      <dl className="r4h-facts">
        <dt>Odds</dt>
        <dd>{oddsWords(hoggie, album.hoggies)}</dd>
      </dl>
    </>
  );
}

export function CloseButton({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button type="button" className="r4h-close" aria-label={label} onClick={onClose}>
      ×
    </button>
  );
}

export function ModalDialog({ className, labelledBy, onClose, children }: { className: string; labelledBy: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const shown = dialog.current;
    if (shown !== null && !shown.open) shown.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

export function ProgressBar({ part, whole }: { part: number; whole: number }) {
  return (
    <span className="r4h-bar" role="presentation">
      <span style={{ width: `${(100 * part) / Math.max(1, whole)}%` }} />
    </span>
  );
}
