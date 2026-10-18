// PROTOTYPE (#625, round 5): the top-bar tray: opened cards wait here as a small stack until you put them in, one at a time or all at once. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { HoggieArt, MemberFace } from "../../art";
import { useAlbum, type Album, type PackOpening } from "../../round-3/album";
import { rarityWords } from "./Cards";
import { firstNameOf } from "./motion";
import { bringsANewFace, completedBy, destinationOf } from "./plan";
import type { PutIn } from "./putIn";
import { useNotInTheTray, usePuttingIn, type Progress } from "./trayState";
import "./tray.css";

export function Tray({ onPutIn }: { onPutIn: PutIn }) {
  const { album } = useAlbum();
  const notInTheTray = useNotInTheTray();
  const progress = usePuttingIn();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useClosingFromOutside(open, root, close);
  const waiting = album.tray.filter(({ pack }) => !notInTheTray.has(pack.id));
  if (album.tray.length === 0 && progress === null) return null;
  const busy = progress !== null;
  const putIn: PutIn = (packIds) => {
    close();
    onPutIn(packIds);
  };
  return (
    <div className="r5-tray" ref={root}>
      <button type="button" className="r5-tray-button" aria-expanded={open} aria-controls="r5-tray-panel" disabled={busy || waiting.length === 0} onClick={() => setOpen(!open)} aria-label={trayLabelOf(waiting.length, progress)}>
        <TrayStack waiting={waiting} />
        <TrayWords waiting={waiting.length} progress={progress} />
      </button>
      {open && !busy && waiting.length > 0 && <TrayPanel album={album} waiting={waiting} onPutIn={putIn} />}
    </div>
  );
}

function trayLabelOf(waiting: number, progress: Progress | null) {
  if (progress !== null) return "Putting your cards in";
  if (waiting === 0) return "Your tray, cards on the way";
  return waiting === 1 ? "1 opened card to put in" : `${waiting} opened cards to put in`;
}

function useClosingFromOutside(open: boolean, root: RefObject<HTMLElement | null>, close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !root.current?.contains(event.target as Node) && latest.current();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && latest.current();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, root]);
}

function TrayStack({ waiting }: { waiting: PackOpening[] }) {
  const top = waiting.slice(-3);
  return (
    <span className="r5-tray-stack" aria-hidden="true" data-empty={waiting.length === 0 ? "" : undefined}>
      {top.map((opening, index) => (
        <span key={opening.pack.id} className="r5-tray-card" style={{ "--at": top.length - 1 - index } as CSSProperties}>
          <MemberFace face={opening.person.face} className="r5-tray-card-face" />
          <span className="r5-tray-card-hoggie">
            <HoggieArt slug={opening.hoggie.hoggie} size={16} />
          </span>
        </span>
      ))}
      {waiting.length > 0 && (
        <span key={waiting.length} className="r5-tray-count">
          {waiting.length}
        </span>
      )}
    </span>
  );
}

function TrayWords({ waiting, progress }: { waiting: number; progress: Progress | null }) {
  if (progress !== null)
    return (
      <span className="r5-tray-words" aria-hidden="true">
        <strong>Putting in…</strong>
        <span>{progress.total === 0 ? "Getting ready" : `${progress.done} of ${progress.total}`}</span>
      </span>
    );
  return (
    <span className="r5-tray-words" aria-hidden="true">
      <strong>{waiting === 0 ? "Your tray" : `${waiting} to put in`}</strong>
      <span>{waiting === 0 ? "Cards on the way" : "Opened cards"}</span>
    </span>
  );
}

function TrayPanel({ album, waiting, onPutIn }: { album: Album; waiting: PackOpening[]; onPutIn: PutIn }) {
  const arriving = new Set(waiting.filter((opening) => bringsANewFace(album, opening)).map(({ person }) => person.key));
  return (
    <div id="r5-tray-panel" className="r5-tray-panel" role="region" aria-label="Opened cards">
      <div className="r5-tray-panel-head">
        <h2>Opened, not in your album yet</h2>
        <p>Each card flies to its place. Put them in one by one, or all at once.</p>
      </div>
      <ul className="r5-tray-rows">
        {waiting.map((opening) => (
          <TrayRow key={opening.pack.id} album={album} opening={opening} arriving={arriving} onPutIn={() => onPutIn([opening.pack.id])} />
        ))}
      </ul>
      <button type="button" className="r5-tray-all" onClick={() => onPutIn("all")} autoFocus>
        {waiting.length === 1 ? "Put it in" : `Put them all in · ${waiting.length}`}
      </button>
    </div>
  );
}

function TrayRow({ album, opening, arriving, onPutIn }: { album: Album; opening: PackOpening; arriving: ReadonlySet<string>; onPutIn: () => void }) {
  const { person, hoggie } = opening;
  return (
    <li className="r5-tray-row">
      <span className="r5-tray-pair" aria-hidden="true">
        <span className="r5-tray-mini r5-tray-mini-person">
          <MemberFace face={person.face} className="r5-tray-mini-face" />
        </span>
        <span className="r5-tray-mini r5-tray-mini-hoggie" style={{ "--rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
          <HoggieArt slug={hoggie.hoggie} size={36} />
        </span>
      </span>
      <span className="r5-tray-where">
        <PersonGoes album={album} opening={opening} arriving={arriving} />
        <span>
          <strong>{hoggie.name}</strong> <span className="r5-tray-goes">→ Hoggies · {rarityWords[hoggie.rarity]}{hoggie.isNew ? ", new" : `, copy #${hoggie.copy}`}</span>
        </span>
      </span>
      <button type="button" className="r5-tray-put" onClick={onPutIn} aria-label={`Put ${firstNameOf(person.name)}'s cards in`}>
        Put in
      </button>
    </li>
  );
}

function PersonGoes({ album, opening, arriving }: { album: Album; opening: PackOpening; arriving: ReadonlySet<string> }) {
  const { person } = opening;
  if (!bringsANewFace(album, opening))
    return (
      <span>
        <strong>{person.name}</strong> <span className="r5-tray-goes">· already in your album</span>
      </span>
    );
  const team = destinationOf(album, opening, new Set([person.key]));
  const completesAlone = completedBy(album, team, new Set([person.key]));
  const completesTogether = !completesAlone && completedBy(album, team, arriving);
  return (
    <span>
      <strong>{person.name}</strong>{" "}
      <span className="r5-tray-goes" data-completes={completesAlone || completesTogether ? "" : undefined}>
        → {team.name} · {completesAlone ? "completes the page!" : completesTogether ? "completes it with the rest of your tray" : `${team.held}/${team.total} → ${team.held + 1}/${team.total}`}
      </span>
    </span>
  );
}
