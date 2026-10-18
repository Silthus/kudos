// PROTOTYPE (#625, round 3): ripping a booster pack: tear the wrapper, reveal the person card, then the glowing hoggie, then add both to the binder. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { AppLink, useNavigate } from "../../../AppLink";
import { MemberFace } from "../../art";
import { personOf, type Album, type AlbumActions, type Pack, type PackOpening } from "../album";
import { rarityWords, teamColourOf } from "./binderPages";
import { CardBack, HoggieCard, PersonCard } from "./Cards";
import { clipped, firstNameOf, usePrefersReducedMotion } from "./motion";

type Step = "sealed" | "stack" | "person" | "glow" | "hoggie" | "flying";

const glowMs = 1100;

const flyMs = 700;

const flourished = new Set(["rare", "epic", "legendary"]);

export function PackTable({ album, actions, asked, onLanded }: { album: Album; actions: AlbumActions; asked: string | null; onLanded: (opening: PackOpening) => void }) {
  const [active, setActive] = useState(() => album.packs.find(({ id }) => id === asked)?.id ?? album.packs[0]?.id ?? null);
  const pack = album.packs.find(({ id }) => id === active) ?? null;
  const others = album.packs.filter(({ id }) => id !== active);
  return (
    <div className="pb-table">
      <div className="pb-table-binder">
        <ClosedBinder album={album} size="small" />
      </div>
      <div className="pb-table-centre">
        {active === null ? (
          <NoPacks />
        ) : (
          <Opening key={active} album={album} actions={actions} pack={pack} onLanded={onLanded} onNext={others[0] === undefined ? null : () => setActive(others[0]!.id)} />
        )}
      </div>
      <aside className="pb-table-next" aria-label="Packs waiting">
        {others.length > 0 && <h2 className="pb-small-heading">Up next</h2>}
        <ul className="pb-mini-packs">
          {others.map((other) => (
            <li key={other.id}>
              <button type="button" className="pb-mini-pack-button" onClick={() => setActive(other.id)}>
                <PackWrapper album={album} pack={other} size="mini" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function NoPacks({ onNext = null }: { onNext?: (() => void) | null }) {
  return (
    <div className="pb-no-packs">
      <h1 className="pb-title">{onNext === null ? "No packs waiting" : "That pack is open"}</h1>
      <p>Thank someone in Slack and say why. Each thoughtful kudos earns a pack, one per person a week.</p>
      {onNext === null ? (
        <AppLink href="/book" className="pb-button pb-button-primary">
          Open the binder
        </AppLink>
      ) : (
        <button type="button" className="pb-button pb-button-primary" onClick={onNext}>
          Open the next pack
        </button>
      )}
    </div>
  );
}

function Opening({ album, actions, pack, onLanded, onNext }: { album: Album; actions: AlbumActions; pack: Pack | null; onLanded: (opening: PackOpening) => void; onNext: (() => void) | null }) {
  const reduced = usePrefersReducedMotion();
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [step, setStep] = useState<Step>("sealed");
  const shown = opening?.pack ?? pack;
  useEffect(() => {
    if (step !== "glow") return;
    const timer = window.setTimeout(() => setStep("hoggie"), glowMs);
    return () => window.clearTimeout(timer);
  }, [step]);
  useEffect(() => {
    if (step !== "flying" || opening === null) return;
    const timer = window.setTimeout(() => onLanded(opening), reduced ? 0 : flyMs);
    return () => window.clearTimeout(timer);
  }, [step, opening, reduced, onLanded]);
  if (shown === null) return <NoPacks onNext={onNext} />;
  const rip = () => {
    if (pack === null) return;
    const opened = actions.openPack(pack.id);
    if (opened === null) return;
    setOpening(opened);
    setStep(reduced ? "hoggie" : "stack");
  };
  const advance = () => {
    if (step === "stack") setStep("person");
    if (step === "person") setStep("glow");
  };
  return (
    <div className="pb-opening" data-step={step}>
      {step === "sealed" ? (
        <SealedPack album={album} pack={shown} onRip={rip} />
      ) : (
        opening !== null && <Reveal album={album} opening={opening} step={step} reduced={reduced} onAdvance={advance} onAdd={() => setStep("flying")} onNext={onNext} />
      )}
    </div>
  );
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
    <div className="pb-sealed">
      <p className="pb-instruction">Drag across the top to rip it open</p>
      <div className="pb-sealed-pack" style={{ "--tear": tear } as CSSProperties}>
        <button type="button" className="pb-tear-strip" aria-label={`Rip open the pack for thanking ${person?.name ?? "a teammate"}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setTear(0)} onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), onRip())}>
          <span className="pb-tear-line" />
          <span className="pb-tear-notch" />
        </button>
        <button type="button" tabIndex={-1} aria-hidden="true" className="pb-pack-body-button" onClick={onRip}>
          <PackWrapper album={album} pack={pack} size="big" />
        </button>
      </div>
      <button type="button" className="pb-link-button" onClick={onRip}>
        Or just click to open
      </button>
    </div>
  );
}

export function PackWrapper({ album, pack, size }: { album: Album; pack: Pack; size: "big" | "fan" | "mini" }) {
  const person = personOf(album, pack.person);
  const colour = teamColourOf(album, person?.teams[0] ?? "");
  return (
    <span className={`pb-pack pb-pack-${size}`} style={{ "--frame": colour } as CSSProperties}>
      <span className="pb-pack-crimp pb-pack-crimp-top" />
      <span className="pb-pack-brand">HedgeHug</span>
      <span className="pb-pack-kind">Booster pack</span>
      {person !== undefined && (
        <span className="pb-pack-face">
          <MemberFace face={person.face} className="pb-pack-face-img" />
        </span>
      )}
      <span className="pb-pack-for">For: {person === undefined ? "a teammate" : firstNameOf(person.name)}</span>
      {size !== "mini" && <span className="pb-pack-quote">“{clipped(pack.message, size === "big" ? 96 : 52)}”</span>}
      <span className="pb-pack-contents">1 card · 1 hoggie</span>
      <span className="pb-pack-crimp pb-pack-crimp-bottom" />
    </span>
  );
}

type RevealProps = { album: Album; opening: PackOpening; step: Step; reduced: boolean; onAdvance: () => void; onAdd: () => void; onNext: (() => void) | null };

function Reveal({ album, opening, step, reduced, onAdvance, onAdd, onNext }: RevealProps) {
  const navigate = useNavigate();
  const person = personOf(album, opening.person.key)!;
  const team = opening.teams[0];
  const colour = teamColourOf(album, person.teams[0]!);
  const teamName = team?.name ?? "";
  const personUp = step !== "stack";
  const hoggieUp = step === "hoggie" || step === "flying";
  const flourish = flourished.has(opening.hoggie.rarity);
  const levelled = opening.xp.levelAfter > opening.xp.levelBefore;
  return (
    <div className="pb-reveal" data-step={step}>
      <div aria-hidden="true" className="pb-torn">
        <span className="pb-torn-strip" />
        <span className="pb-torn-body" />
      </div>
      <div className="pb-reveal-cards">
        <button type="button" className="pb-reveal-slot pb-reveal-person" data-up={personUp ? "" : undefined} onClick={onAdvance} disabled={step !== "stack" && step !== "person"} aria-label={personUp ? `${person.name}'s card` : "Reveal the first card"}>
          <span className="pb-flip" data-flipped={personUp ? "" : undefined}>
            <span className="pb-flip-face pb-flip-back">
              <CardBack />
            </span>
            <span className={`pb-flip-face pb-flip-front ${team?.justCompleted ? "pb-gold" : ""}`}>
              <PersonCard person={person} colour={colour} teamName={teamName} size="big" />
            </span>
          </span>
        </button>
        <button type="button" className="pb-reveal-slot pb-reveal-hoggie" data-rarity={opening.hoggie.rarity} data-glow={step === "glow" ? "" : undefined} data-up={hoggieUp ? "" : undefined} onClick={onAdvance} disabled={step !== "stack" && step !== "person"} aria-label={hoggieUp ? `${opening.hoggie.name}, ${rarityWords[opening.hoggie.rarity]}` : "The hoggie card, face down"} style={{ "--rarity": `var(--rarity-${opening.hoggie.rarity})` } as CSSProperties}>
          {hoggieUp && flourish && !reduced && <span aria-hidden="true" className="pb-burst" />}
          <span className="pb-flip" data-flipped={hoggieUp ? "" : undefined}>
            <span className="pb-flip-face pb-flip-back">
              <CardBack />
            </span>
            <span className="pb-flip-face pb-flip-front">
              <HoggieCard hoggie={opening.hoggie} size="big" copy={opening.hoggie.copy} />
            </span>
          </span>
        </button>
      </div>
      <div className="pb-reveal-caption" aria-live="polite">
        {step === "stack" && (
          <>
            <p className="pb-caption-title">Two cards inside</p>
            <button type="button" className="pb-button pb-button-primary" onClick={onAdvance}>
              Reveal the first card
            </button>
          </>
        )}
        {(step === "person" || ((step === "hoggie" || step === "flying") && reduced)) && <PersonCaption opening={opening} kudos={person.stats.kudosGiven} />}
        {step === "person" && (
          <button type="button" className="pb-button pb-button-primary" onClick={onAdvance}>
            Next card
          </button>
        )}
        {step === "glow" && <p className="pb-caption-title pb-glow-word">Something {rarityWords[opening.hoggie.rarity].toLowerCase()}…</p>}
        {(step === "hoggie" || step === "flying") && (
          <>
            <p className="pb-caption-title">
              {opening.hoggie.isNew ? <span className="pb-new-tag">New hoggie!</span> : <span className="pb-copy-tag">Copy #{opening.hoggie.copy}</span>} {opening.hoggie.name}
              <span className="pb-rarity-word" style={{ color: `var(--rarity-${opening.hoggie.rarity})` }}>
                {" "}
                · {rarityWords[opening.hoggie.rarity]}
              </span>
            </p>
            {levelled && <p className="pb-quiet">Level {opening.xp.levelAfter} · your badge moved up.</p>}
            <div className="pb-caption-actions">
              <button type="button" className="pb-button pb-button-primary" onClick={onAdd} disabled={step === "flying"}>
                Add to binder
              </button>
              {onNext !== null && step === "hoggie" && (
                <button type="button" className="pb-button" onClick={onNext}>
                  Open the next pack
                </button>
              )}
              {step === "hoggie" && (
                <button type="button" className="pb-link-button" onClick={() => navigate("/")}>
                  Later
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PersonCaption({ opening, kudos }: { opening: PackOpening; kudos: number }) {
  const first = firstNameOf(opening.person.name);
  if (!opening.person.isNew)
    return (
      <p className="pb-caption-title">
        {first} is already in your binder <span className="pb-quiet">· {kudos === 1 ? "1 thank-you" : `${kudos} thank-yous`} so far</span>
      </p>
    );
  return (
    <>
      <p className="pb-caption-title">
        <span className="pb-new-tag">New card!</span> {opening.person.name}
      </p>
      <ul className="pb-set-lines">
        {opening.teams.map((team) => (
          <li key={team.team} data-complete={team.justCompleted ? "" : undefined}>
            {team.name} <span className="pb-set-before">{team.held - 1}/{team.total}</span> → <span className="pb-set-after">{team.held}/{team.total}</span>
            {team.justCompleted && <strong className="pb-set-complete">Set complete!</strong>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function ClosedBinder({ album, size }: { album: Album; size: "big" | "small" }) {
  return (
    <span className={`pb-closed pb-closed-${size}`}>
      <span className="pb-closed-spine">
        <span className="pb-spine-label">{album.me.name}</span>
      </span>
      <span className="pb-closed-cover">
        <span className="pb-closed-emboss">HedgeHug</span>
        <span className="pb-closed-sub">Binder</span>
      </span>
    </span>
  );
}
