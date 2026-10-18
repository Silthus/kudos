// PROTOTYPE (#625, round 3): tearing a sticker packet open and flipping its stickers, the album's big moment. Never merge to main.
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { Album, AlbumActions, Pack, PackOpening } from "../album";
import { AppLink } from "../../../AppLink";
import { HedgehogHeart } from "../../../hoggies";
import { firstNameOf, motionMs, plural, rarityWords, shinyRarities, type Spread } from "./model";
import { HoggieSticker, PersonSticker, StickerBack } from "./Stickers";

type Phase = "sealed" | "tearing" | "reveal";

export function PacksPlace({ album, actions, spreads, onStick }: { album: Album; actions: AlbumActions; spreads: Spread[]; onStick: (opening: PackOpening) => void }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [opening, setOpening] = useState<PackOpening | null>(null);
  const [phase, setPhase] = useState<Phase>("sealed");
  const chosen = album.packs.find(({ id }) => id === chosenId) ?? album.packs[0];
  const pack = opening?.pack ?? chosen;

  useEffect(() => {
    if (phase !== "tearing") return;
    const timer = window.setTimeout(() => setPhase("reveal"), motionMs(820));
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (pack === undefined) return <NoPacks />;
  const tear = () => {
    if (opening !== null || chosen === undefined) return;
    const opened = actions.openPack(chosen.id);
    if (opened === null) return;
    setOpening(opened);
    setPhase("tearing");
  };
  const waiting = album.packs.filter(({ id }) => id !== pack.id);
  return (
    <div className="sa-packs">
      <header className="sa-packs-head">
        <p className="sa-kicker">Thank-you packs</p>
        <h1>{opening === null ? `${plural(album.packs.length, "pack")} to open` : phase === "reveal" ? "Flip your stickers" : "Tearing it open…"}</h1>
      </header>
      {phase !== "reveal" ? <Packet key={pack.id} pack={pack} album={album} phase={phase} onTear={tear} /> : <Reveal key={opening!.pack.id} opening={opening!} spreads={spreads} onStick={() => onStick(opening!)} />}
      {opening === null && waiting.length > 0 && (
        <aside className="sa-packs-waiting" aria-label="Other packs">
          <p className="sa-quiet">Also waiting</p>
          {waiting.map((other) => (
            <button key={other.id} type="button" className="sa-mini-packet" onClick={() => setChosenId(other.id)}>
              <span className="sa-mini-packet-art" aria-hidden="true" />
              <span>From thanking {firstNameOf(nameOf(album, other.person))}</span>
            </button>
          ))}
        </aside>
      )}
      <AppLink href="/book" className="sa-packs-back">
        ← Back to the album
      </AppLink>
    </div>
  );
}

function nameOf(album: Album, key: string) {
  return album.people.find((person) => person.key === key)?.name ?? "a teammate";
}

function NoPacks() {
  return (
    <div className="sa-packs sa-packs-empty">
      <span aria-hidden="true">
        <HedgehogHeart size={160} />
      </span>
      <h1>No packs waiting</h1>
      <p>Thank someone in Slack and say why. Each person you thank earns you a pack, once a week: their sticker the first time, and always a surprise hoggie.</p>
      <AppLink href="/book" className="sa-button">
        Back to the album
      </AppLink>
    </div>
  );
}

const teeth = 18;

const crimp = (() => {
  const top = Array.from({ length: teeth * 2 + 1 }, (_, i) => `${((i / (teeth * 2)) * 100).toFixed(2)}% ${i % 2 === 0 ? 0 : 8}px`);
  const bottom = Array.from({ length: teeth * 2 + 1 }, (_, i) => `${(100 - (i / (teeth * 2)) * 100).toFixed(2)}% calc(100% - ${i % 2 === 0 ? 0 : 8}px)`);
  return `polygon(${[...top, ...bottom].join(", ")})`;
})();

function Packet({ pack, album, phase, onTear }: { pack: Pack; album: Album; phase: Phase; onTear: () => void }) {
  const [pull, setPull] = useState(0);
  const start = useRef<number | null>(null);
  const name = nameOf(album, pack.person);
  const [isNew] = useState(() => album.people.find(({ key }) => key === pack.person)?.collectedAt === null);
  const down = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = event.clientX;
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    setPull(Math.min(1, Math.max(0, (event.clientX - start.current) / 220)));
  };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (pull > 0.5 || pull < 0.04) onTear();
    else setPull(0);
  };
  const torn = phase === "tearing";
  return (
    <div className={`sa-packet-wrap ${torn ? "sa-packet-torn" : ""}`}>
      <div className="sa-packet" style={{ clipPath: crimp } as CSSProperties}>
        <button
          type="button"
          className="sa-packet-strip"
          style={{ "--pull": pull } as CSSProperties}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => {
            start.current = null;
            setPull(0);
          }}
          onClick={(event) => {
            if (event.detail === 0) onTear();
          }}
          disabled={torn}
          aria-label="Tear the pack open"
        >
          <span className="sa-packet-perforation" />
          <span className="sa-packet-rip" />
          <span className="sa-packet-hint">{torn ? "" : "✂  Drag along the dotted line, or click"}</span>
        </button>
        <div className="sa-packet-body">
          <span className="sa-packet-brand">HedgeHug</span>
          <span className="sa-packet-title">Sticker pack</span>
          <span className="sa-packet-hog" aria-hidden="true">
            <HedgehogHeart size={150} />
          </span>
          <span className="sa-packet-from">From thanking {name}</span>
          <span className="sa-packet-quote">“{pack.message}”</span>
          <span className="sa-packet-contents">{isNew ? "2 stickers inside" : "1 hoggie inside"}</span>
          <span className="sa-packet-sheen" />
        </div>
      </div>
      {torn && <span className="sa-packet-flying" style={{ clipPath: crimp } as CSSProperties} aria-hidden="true" />}
    </div>
  );
}

function Reveal({ opening, spreads, onStick }: { opening: PackOpening; spreads: Spread[]; onStick: () => void }) {
  const cards = opening.person.isNew ? (["person", "hoggie"] as const) : (["hoggie"] as const);
  const [flipped, setFlipped] = useState(0);
  const done = flipped >= cards.length;
  const stick = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (done) stick.current?.focus({ preventScroll: true });
  }, [done]);
  return (
    <div className="sa-reveal">
      {!opening.person.isNew && <p className="sa-reveal-note">{firstNameOf(opening.person.name)} is already in your album, so this pack holds a hoggie.</p>}
      <div className="sa-reveal-row">
        {cards.map((card, at) => (
          <RevealCard key={card} kind={card} opening={opening} spreads={spreads} order={at} flipped={at < flipped} next={at === flipped} onFlip={() => setFlipped(at + 1)} />
        ))}
      </div>
      <div className={`sa-reveal-actions ${done ? "sa-reveal-actions-on" : ""}`}>
        {done && (
          <>
            <button ref={stick} type="button" className="sa-button sa-button-big" onClick={onStick}>
              Stick {cards.length === 1 ? "it" : "them"} in →
            </button>
            <p className="sa-quiet">
              +{opening.xp.gained} XP{opening.xp.levelAfter > opening.xp.levelBefore ? ` · you reached level ${opening.xp.levelAfter}` : ""}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function RevealCard({ kind, opening, spreads, order, flipped, next, onFlip }: { kind: "person" | "hoggie"; opening: PackOpening; spreads: Spread[]; order: number; flipped: boolean; next: boolean; onFlip: () => void }) {
  const shiny = shinyRarities.has(opening.hoggie.rarity);
  const label = kind === "person" ? "Flip the first sticker" : "Flip the hoggie sticker";
  return (
    <div className={`sa-reveal-slot sa-reveal-${kind}`} style={{ "--order": order } as CSSProperties}>
      <button type="button" className={`sa-flip ${flipped ? "sa-flip-on" : ""} ${next ? "sa-flip-next" : ""} ${kind === "hoggie" && shiny ? `sa-flip-shiny sa-flip-${opening.hoggie.rarity}` : ""}`} onClick={next ? onFlip : undefined} disabled={!next && !flipped} aria-label={flipped ? undefined : label} aria-pressed={flipped}>
        <span className="sa-flip-inner">
          <span className="sa-flip-face sa-flip-back">
            <StickerBack size={kind === "person" ? 1 : 0.9} />
            {next && <span className="sa-flip-hint">Tap to flip</span>}
          </span>
          <span className="sa-flip-face sa-flip-front">{kind === "person" ? <PersonFace opening={opening} spreads={spreads} /> : <HoggieSticker hoggie={opening.hoggie} width={230} number={null} />}</span>
        </span>
      </button>
      {flipped && (kind === "person" ? <PersonCaption opening={opening} /> : <HoggieCaption opening={opening} />)}
    </div>
  );
}

function PersonFace({ opening, spreads }: { opening: PackOpening; spreads: Spread[] }) {
  const spread = spreads.find((entry) => entry.kind === "team" && entry.team.team === opening.person.teams[0]);
  const colour = spread?.kind === "team" ? spread.colour : "#F54E00";
  return <PersonSticker person={{ ...opening.person, role: null }} number={null} look={{ width: 260, colour }} teamName={spread?.kind === "team" ? spread.team.name : ""} />;
}

function PersonCaption({ opening }: { opening: PackOpening }) {
  const [ticked, setTicked] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setTicked(true), motionMs(700));
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="sa-caption">
      <span className="sa-caption-banner">New in your album!</span>
      {opening.teams.map((team) => (
        <span key={team.team} className="sa-caption-team">
          {team.name}{" "}
          <b key={String(ticked)} className={ticked ? "sa-tick" : undefined}>
            {ticked ? team.held : team.held - 1}
          </b>
          /{team.total}
          {team.justCompleted && ticked && <span className="sa-caption-complete">Team complete!</span>}
        </span>
      ))}
    </div>
  );
}

function HoggieCaption({ opening }: { opening: PackOpening }) {
  const { hoggie } = opening;
  return (
    <div className="sa-caption" style={{ "--rarity": `var(--rarity-${hoggie.rarity})` } as CSSProperties}>
      <span className="sa-caption-rarity">{rarityWords[hoggie.rarity]}</span>
      <span className="sa-caption-name">{hoggie.name}</span>
      <span className={hoggie.isNew ? "sa-caption-banner" : "sa-caption-copy"}>{hoggie.isNew ? "New!" : `Copy #${hoggie.copy}`}</span>
    </div>
  );
}
