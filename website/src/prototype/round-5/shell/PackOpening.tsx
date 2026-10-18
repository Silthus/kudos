// PROTOTYPE (#625, round 5): the pack opening, round 4's card flips and celebration, with the opened cards flying up into the top-bar tray. Never merge to main.
import { IconX } from "@posthog/icons";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { personOf, useAlbum, type Album, type AlbumActions, type Pack, type PackOpening as Opened } from "../../round-3/album";
import { CardBack, HoggieCard, PackWrapper, PersonCard, rarityWords, teamColourOf, type Tally } from "./Cards";
import { ConfettiBurst, NewRibbon, RaritySparkles, ShineSweep, SoftRing } from "./Celebration";
import { boxOf, fly } from "./Flights";
import { closePacks } from "./history";
import { firstNameOf, holdXpAt, releaseXp, usePrefersReducedMotion } from "./motion";
import { keepOutOfTheTray, showInTheTray } from "./trayState";
import "./opening.css";

type Step = "sealed" | "stack" | "person" | "glow" | "hoggie" | "tucking";

type AfterTuck = "next" | "close" | "put-all-in";

const glowMs = 1100;

const xpLandsAfterMs = 520;

const sparklesOf = { common: 0, uncommon: 0, rare: 12, epic: 16, legendary: 22 } as const;

export function PackOpening({ onPutAllIn }: { onPutAllIn: () => void }) {
  const { album, actions } = useAlbum();
  const [active, setActive] = useState(() => album.packs[0]?.id ?? null);
  const [opened, setOpened] = useState<Opened[]>([]);
  const waiting = album.packs.filter(({ id }) => id !== active);
  const finish = closePacks;
  useEscapeTo(finish);
  useEffect(() => releaseXp, []);
  const remember = useCallback((opening: Opened) => setOpened((list) => [...list, opening]), []);
  return (
    <div className="r5o" role="dialog" aria-modal="true" aria-label="Open your packs">
      <div className="r5o-head">
        <p className="r5o-head-words">{headWordsOf(opened.length, album.packs.length)}</p>
        <button type="button" className="r5o-close" onClick={finish} aria-label="Close the pack opening">
          <IconX />
        </button>
      </div>
      <div className="r5o-stage">
        {active === null ? (
          <NoPacks openedAny={opened.length > 0} onDone={finish} />
        ) : (
          <Opening key={active} album={album} actions={actions} packId={active} waitingAfter={waiting.length} onOpened={remember} onNext={waiting[0] === undefined ? null : () => setActive(waiting[0]!.id)} onDone={finish} onPutAllIn={onPutAllIn} />
        )}
      </div>
      {waiting.length > 0 && <UpNext album={album} waiting={waiting} onPick={setActive} />}
    </div>
  );
}

function headWordsOf(openedCount: number, waitingCount: number) {
  const waiting = waitingCount === 0 ? "none left" : waitingCount === 1 ? "1 pack waiting" : `${waitingCount} packs waiting`;
  return openedCount === 0 ? waiting : `${openedCount} opened · ${waiting}`;
}

function useEscapeTo(finish: () => void) {
  const latest = useRef(finish);
  latest.current = finish;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && latest.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function UpNext({ album, waiting, onPick }: { album: Album; waiting: Pack[]; onPick: (id: string) => void }) {
  return (
    <aside className="r5o-next" aria-label="Packs waiting">
      <h2 className="r5o-next-title">Up next</h2>
      <ul className="r5o-next-packs">
        {waiting.map((pack) => (
          <li key={pack.id}>
            <button type="button" className="r5o-next-pack" onClick={() => onPick(pack.id)} aria-label={`Open the pack for thanking ${personOf(album, pack.person)?.name ?? "a teammate"}`}>
              <PackWrapper album={album} pack={pack} size="mini" />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function NoPacks({ openedAny, onDone }: { openedAny: boolean; onDone: () => void }) {
  return (
    <div className="r5o-none">
      <h1 className="r5o-none-title">{openedAny ? "All packs opened" : "No packs waiting"}</h1>
      <p>{openedAny ? "Your cards wait in the tray at the top. Click it to put them in." : "Thank someone in Slack and say why. Each thoughtful kudos earns a pack, one per person a week."}</p>
      <button type="button" className="r5o-button r5o-button-warm" onClick={onDone} autoFocus>
        Back to the album
      </button>
    </div>
  );
}

type OpeningProps = { album: Album; actions: AlbumActions; packId: string; waitingAfter: number; onOpened: (opening: Opened) => void; onNext: (() => void) | null; onDone: () => void; onPutAllIn: () => void };

function Opening({ album, actions, packId, waitingAfter, onOpened, onNext, onDone, onPutAllIn }: OpeningProps) {
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [opening, setOpening] = useState<Opened | null>(null);
  const [step, setStep] = useState<Step>("sealed");
  const pack = album.packs.find(({ id }) => id === packId) ?? opening?.pack ?? null;
  useStepTimer(step === "glow", glowMs, () => setStep("hoggie"));
  useStepTimer(step === "person", xpLandsAfterMs, releaseXp);
  useShownInTheTrayWhenGone(opening?.pack.id ?? null);
  if (pack === null) return null;
  const rip = () => {
    if (opening !== null) return;
    holdXpAt(album.level.xp);
    const opened = actions.openPack(pack.id);
    if (opened === null) return releaseXp();
    keepOutOfTheTray(opened.pack.id);
    setOpening(opened);
    onOpened(opened);
    if (reduced) releaseXp();
    setStep(reduced ? "hoggie" : "stack");
  };
  const advance = () => {
    if (step === "stack") setStep("person");
    if (step === "person") setStep("glow");
  };
  const tuck = (after: AfterTuck) => {
    if (opening === null || step === "tucking") return;
    const cards = cardsOf(album, opening);
    setStep("tucking");
    void gatherIntoTheTray(root.current, cards).then(() => {
      showInTheTray(opening.pack.id);
      if (after === "next" && onNext !== null) return onNext();
      onDone();
      if (after === "put-all-in") onPutAllIn();
    });
  };
  return (
    <div ref={root} className="r5o-opening" data-step={step}>
      {step === "sealed" || opening === null ? (
        <SealedPack album={album} pack={pack} onRip={rip} />
      ) : (
        <Reveal album={album} opening={opening} step={step} reduced={reduced} waitingAfter={waitingAfter} onAdvance={advance} onTuck={tuck} hasNext={onNext !== null} />
      )}
    </div>
  );
}

function useShownInTheTrayWhenGone(packId: string | null) {
  useEffect(() => {
    if (packId === null) return;
    return () => showInTheTray(packId);
  }, [packId]);
}

function cardsOf(album: Album, opening: Opened): ReactNode[] {
  const tally = tallyOf(album, opening);
  const person = personOf(album, opening.person.key)!;
  return [
    <span key="person" className={`r5-flown-card ${tally?.justCompleted ? "r5o-gold" : ""}`}>
      <PersonCard person={person} colour={teamColourOf(album, person.teams[0]!)} tally={tally} />
    </span>,
    <span key="hoggie" className="r5-flown-card">
      <HoggieCard hoggie={opening.hoggie} copy={opening.hoggie.copy} />
    </span>,
  ];
}

async function gatherIntoTheTray(root: HTMLElement | null, cards: ReactNode[]) {
  const tray = document.querySelector(".r5 .r5-tray-stack");
  if (root === null || tray === null) return;
  const to = boxOf(tray);
  const faces = [...root.querySelectorAll<HTMLElement>(".r5o-flip-front")];
  await Promise.all(faces.map((face, index) => fly({ content: cards[index], width: face.offsetWidth, height: face.offsetHeight, from: boxOf(face), to, arc: 70, durationMs: 720, delayMs: index * 120, spin: index === 0 ? -12 : 10 })));
}

function tallyOf(album: Album, opening: Opened): Tally | null {
  const shownTeam = opening.teams.find(({ justCompleted }) => justCompleted) ?? opening.teams[0];
  const teamArt = album.teams.find(({ team }) => team === shownTeam?.team)?.art;
  if (shownTeam === undefined || teamArt === undefined) return null;
  return { name: shownTeam.name, art: teamArt, held: shownTeam.held, total: shownTeam.total, justCompleted: shownTeam.justCompleted, ticking: opening.person.isNew };
}

function useStepTimer(running: boolean, afterMs: number, then: () => void) {
  const latest = useRef(then);
  latest.current = then;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => latest.current(), afterMs);
    return () => window.clearTimeout(timer);
  }, [running, afterMs]);
}

function SealedPack({ album, pack, onRip }: { album: Album; pack: Pack; onRip: () => void }) {
  const [tear, setTear] = useState(0);
  const start = useRef<{ x: number; width: number } | null>(null);
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width: event.currentTarget.getBoundingClientRect().width };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    setTear(Math.min(1, Math.max(0, (event.clientX - start.current.x) / (start.current.width * 0.55))));
  };
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const began = start.current;
    start.current = null;
    if (began === null) return;
    const moved = Math.abs(event.clientX - began.x);
    if (moved < 6 || tear > 0.5) return onRip();
    setTear(0);
  };
  const person = personOf(album, pack.person);
  return (
    <div className="r5o-sealed">
      <p className="r5o-instruction">Drag across the top to rip it open</p>
      <div className="r5o-sealed-pack" style={{ "--tear": tear } as CSSProperties}>
        <button type="button" className="r5o-tear-strip" aria-label={`Rip open the pack for thanking ${person?.name ?? "a teammate"}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setTear(0)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), onRip())} autoFocus>
          <span className="r5o-tear-line" />
          <span className="r5o-tear-notch" />
        </button>
        <button type="button" tabIndex={-1} aria-hidden="true" className="r5o-pack-body-button" onClick={onRip}>
          <PackWrapper album={album} pack={pack} size="big" />
        </button>
      </div>
      <button type="button" className="r5o-link-button" onClick={onRip}>
        Or just click to open
      </button>
    </div>
  );
}

type RevealProps = { album: Album; opening: Opened; step: Step; reduced: boolean; waitingAfter: number; onAdvance: () => void; onTuck: (after: AfterTuck) => void; hasNext: boolean };

function Reveal({ album, opening, step, reduced, waitingAfter, onAdvance, onTuck, hasNext }: RevealProps) {
  const person = personOf(album, opening.person.key)!;
  const tally = tallyOf(album, opening);
  const personUp = step !== "stack";
  const hoggieUp = step === "hoggie" || step === "tucking";
  const celebrating = !reduced;
  const teamComplete = tally?.justCompleted === true;
  const sparkles = sparklesOf[opening.hoggie.rarity];
  return (
    <div className="r5o-reveal" data-step={step} data-reduced={reduced ? "" : undefined}>
      {celebrating && (
        <div aria-hidden="true" className="r5o-torn">
          <span className="r5o-torn-strip" />
          <span className="r5o-torn-body" />
        </div>
      )}
      <div className="r5o-reveal-cards">
        {celebrating && step === "person" && opening.person.isNew && <ConfettiBurst kind={teamComplete ? "gold" : "modest"} seed={opening.pack.earnedAt % 9973} />}
        <button type="button" className="r5o-slot r5o-slot-person" data-up={personUp ? "" : undefined} onClick={onAdvance} disabled={step !== "stack" && step !== "person"} aria-label={personUp ? `${person.name}'s card` : "Reveal the first card"}>
          {celebrating && personUp && <SoftRing />}
          <span className="r5o-flip" data-flipped={personUp ? "" : undefined}>
            <span className="r5o-flip-face r5o-flip-back">
              <CardBack />
            </span>
            <span className={`r5o-flip-face r5o-flip-front ${teamComplete ? "r5o-gold" : ""}`}>
              <PersonCard person={person} colour={teamColourOf(album, person.teams[0]!)} tally={tally} />
              {opening.person.isNew && <NewRibbon />}
              {celebrating && personUp && <ShineSweep />}
            </span>
          </span>
        </button>
        <button type="button" className="r5o-slot r5o-slot-hoggie" data-rarity={opening.hoggie.rarity} data-glow={step === "glow" ? "" : undefined} data-up={hoggieUp ? "" : undefined} onClick={onAdvance} disabled={step !== "stack" && step !== "person"} aria-label={hoggieUp ? `${opening.hoggie.name}, ${rarityWords[opening.hoggie.rarity]}` : "The hoggie card, face down"} style={{ "--rarity": `var(--rarity-${opening.hoggie.rarity})` } as CSSProperties}>
          {celebrating && hoggieUp && sparkles > 0 && <span aria-hidden="true" className="r5o-burst" />}
          {celebrating && hoggieUp && sparkles > 0 && <RaritySparkles count={sparkles} seed={opening.hoggie.copy * 31 + opening.hoggie.name.length} />}
          {celebrating && hoggieUp && <SoftRing />}
          <span className="r5o-flip" data-flipped={hoggieUp ? "" : undefined}>
            <span className="r5o-flip-face r5o-flip-back">
              <CardBack />
            </span>
            <span className="r5o-flip-face r5o-flip-front">
              <HoggieCard hoggie={opening.hoggie} copy={opening.hoggie.copy} />
              {opening.hoggie.isNew && <NewRibbon />}
              {celebrating && hoggieUp && <ShineSweep />}
            </span>
          </span>
        </button>
      </div>
      <div className="r5o-caption" aria-live="polite">
        {step === "stack" && <StackCaption onAdvance={onAdvance} />}
        {(step === "person" || (reduced && hoggieUp)) && <PersonCaption opening={opening} thanks={person.stats.kudosGiven} />}
        {step === "person" && (
          <button type="button" className="r5o-button r5o-button-warm" onClick={onAdvance} autoFocus>
            Next card
          </button>
        )}
        {step === "glow" && <p className="r5o-caption-title r5o-glow-word">Something {rarityWords[opening.hoggie.rarity].toLowerCase()}…</p>}
        {hoggieUp && <HoggieCaption opening={opening} waitingAfter={waitingAfter} tucking={step === "tucking"} onTuck={onTuck} hasNext={hasNext} />}
      </div>
    </div>
  );
}

function StackCaption({ onAdvance }: { onAdvance: () => void }) {
  return (
    <>
      <p className="r5o-caption-title">Two cards inside</p>
      <button type="button" className="r5o-button r5o-button-warm" onClick={onAdvance} autoFocus>
        Reveal the first card
      </button>
    </>
  );
}

function PersonCaption({ opening, thanks }: { opening: Opened; thanks: number }) {
  const first = firstNameOf(opening.person.name);
  if (!opening.person.isNew)
    return (
      <p className="r5o-caption-title">
        {first} is already in your album <span className="r5o-quiet">· {thanks === 1 ? "1 thank-you" : `${thanks} thank-yous`} so far</span>
      </p>
    );
  const completed = opening.teams.find(({ justCompleted }) => justCompleted);
  return (
    <>
      {completed !== undefined && <p className="r5o-complete-banner">Team complete! · {completed.name}</p>}
      <p className="r5o-caption-title">
        <span className="r5o-new-tag">New card</span> {opening.person.name}
      </p>
      <ul className="r5o-set-lines">
        {opening.teams.map((team) => (
          <li key={team.team} data-complete={team.justCompleted ? "" : undefined}>
            {team.name} <span className="r5o-set-before">{team.held - 1}/{team.total}</span> → <span className="r5o-set-after">{team.held}/{team.total}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function HoggieCaption({ opening, waitingAfter, tucking, onTuck, hasNext }: { opening: Opened; waitingAfter: number; tucking: boolean; onTuck: (after: AfterTuck) => void; hasNext: boolean }) {
  const levelled = opening.xp.levelAfter > opening.xp.levelBefore;
  return (
    <>
      <p className="r5o-caption-title">
        {opening.hoggie.isNew ? <span className="r5o-new-tag">New hoggie</span> : <span className="r5o-copy-tag">Copy #{opening.hoggie.copy}</span>} {opening.hoggie.name}
        <span className="r5o-rarity-word" style={{ color: `var(--rarity-${opening.hoggie.rarity})` }}>
          {" "}
          · {rarityWords[opening.hoggie.rarity]}
        </span>
      </p>
      <p className="r5o-quiet">{levelled ? `+${opening.xp.gained} XP · Level ${opening.xp.levelAfter}, your level moved up.` : `+${opening.xp.gained} XP`}</p>
      <div className="r5o-caption-actions">
        {hasNext ? (
          <>
            <button type="button" className="r5o-button r5o-button-warm" onClick={() => onTuck("next")} disabled={tucking} autoFocus>
              Open next pack · {waitingAfter} left
            </button>
            <button type="button" className="r5o-button r5o-button-quiet" onClick={() => onTuck("close")} disabled={tucking}>
              Done for now
            </button>
          </>
        ) : (
          <>
            <button type="button" className="r5o-button r5o-button-warm" onClick={() => onTuck("put-all-in")} disabled={tucking} autoFocus>
              Put them all in
            </button>
            <button type="button" className="r5o-button r5o-button-quiet" onClick={() => onTuck("close")} disabled={tucking}>
              Leave them in the tray
            </button>
          </>
        )}
      </div>
      <p className="r5o-quiet">These cards fly up to the tray at the top until you put them in.</p>
    </>
  );
}
