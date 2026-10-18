// PROTOTYPE (#625, round 3) the yearbook's pack opening: a sealed envelope, a developing portrait, a hoggie that hops out, then a flight into the team row. Never merge to main.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { HedgehogHeart } from "../../../hoggies";
import { AppLink } from "../../../AppLink";
import { prefersReducedMotion } from "../../../reducedMotion";
import { CrestArt, HoggieArt, MemberFace } from "../../art";
import { useAlbum, type Album, type Pack, type PackOpening } from "../album";
import { firstNameOf, isShiny, ProgressRing, rarityWords, Ribbon, teammatesOf, whenOf } from "./parts";
import { Portrait } from "./Portrait";

type Phase = "sealed" | "opening" | "rising" | "developing" | "hoggie" | "ready" | "landing" | "landed";

const timeline: [Phase, number][] = [
  ["rising", 650],
  ["developing", 1450],
  ["hoggie", 3100],
  ["ready", 4500],
];

const phaseOrder: Phase[] = ["sealed", "opening", "rising", "developing", "hoggie", "ready", "landing", "landed"];

function reached(phase: Phase, step: Phase) {
  return phaseOrder.indexOf(phase) >= phaseOrder.indexOf(step);
}

export function PackPlace() {
  const { album, actions } = useAlbum();
  const [opening, setOpening] = useState<PackOpening | null>(album.lastOpening);
  const [phase, setPhase] = useState<Phase>(album.lastOpening === null ? "sealed" : "ready");
  const timers = useRef<number[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const flight = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, DOMRect>>(new Map());

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const breakSeal = (pack: Pack) => {
    const opened = actions.openPack(pack.id);
    if (opened === null) return;
    setOpening(opened);
    if (prefersReducedMotion()) {
      setPhase("ready");
      return;
    }
    setPhase("opening");
    timers.current = timeline.map(([next, at]) => window.setTimeout(() => setPhase(next), at));
  };

  const skipAhead = () => {
    if (reached(phase, "ready") || phase === "sealed") return;
    clearTimers();
    setPhase("ready");
  };

  const putInAlbum = () => {
    before.current = positionsIn(strip.current);
    const card = flight.current;
    const slot = opening === null ? null : strip.current?.querySelector<HTMLElement>(`[data-key="${opening.person.key}"] .ty-portrait`);
    if (prefersReducedMotion() || card === null || slot === null || slot === undefined) {
      setPhase("landed");
      return;
    }
    const from = card.querySelector(".ty-polaroid-photo")!.getBoundingClientRect();
    const to = slot.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = to.width / from.width;
    setPhase("landing");
    const flying = card.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 70}px) scale(${(1 + scale) / 1.6}) rotate(-4deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.85 },
      ],
      { duration: 820, easing: "cubic-bezier(.55,0,.25,1)", fill: "forwards" },
    );
    flying.onfinish = () => setPhase("landed");
  };

  useLayoutEffect(() => {
    if (phase !== "landed" || prefersReducedMotion()) return;
    const after = positionsIn(strip.current);
    for (const [key, rect] of after) {
      const was = before.current.get(key);
      const item = strip.current?.querySelector<HTMLElement>(`[data-key="${key}"]`);
      if (was === undefined || item === null || item === undefined) continue;
      const dx = was.left - rect.left;
      const dy = was.top - rect.top;
      if (dx === 0 && dy === 0) continue;
      item.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 480, easing: "cubic-bezier(.3,0,.2,1)" });
    }
  }, [phase]);

  const next = useCallback(() => {
    actions.forgetOpening();
    setOpening(null);
    setPhase("sealed");
  }, [actions]);

  if (opening === null) {
    const pack = album.packs[0];
    if (pack === undefined) return <NoPacks />;
    return <Sealed key={pack.id} album={album} pack={pack} onBreak={() => breakSeal(pack)} />;
  }
  return (
    <section className="ty-opening" aria-labelledby="ty-opening-title">
      <OpeningHead album={album} opening={opening} phase={phase} />
      <div ref={stage} className="ty-stage" data-phase={phase} onClick={skipAhead} style={{ "--ty-rarity": `var(--rarity-${opening.hoggie.rarity})` } as CSSProperties}>
        <Reveal opening={opening} phase={phase} />
        <div className="ty-card-clip">
          <div ref={flight} className="ty-flight">
            <Polaroid opening={opening} />
          </div>
        </div>
        <Envelope pack={opening.pack} name={opening.person.name} />
        <HoggieReveal opening={opening} />
        {reached(phase, "landed") && <p className="ty-landed-note">{firstNameOf(opening.person.name)} is on {opening.teams[0] === undefined ? "your album's" : `the ${opening.teams[0].name}`} page now.</p>}
      </div>
      <Finish album={album} opening={opening} phase={phase} onPutInAlbum={putInAlbum} onNext={next} />
      <div ref={strip}>
        <TeamStrip album={album} personKey={opening.person.key} teamKey={opening.teams[0]?.team} holdingBack={opening.person.isNew && !reached(phase, "landed") ? opening.person.key : null} landed={reached(phase, "landed")} />
      </div>
      <p className="ty-sr" aria-live="polite">
        {reached(phase, "ready") ? announcementOf(opening) : ""}
      </p>
    </section>
  );
}

function positionsIn(strip: HTMLElement | null) {
  const positions = new Map<string, DOMRect>();
  strip?.querySelectorAll<HTMLElement>("[data-key]").forEach((item) => positions.set(item.dataset.key!, item.getBoundingClientRect()));
  return positions;
}

function announcementOf(opening: PackOpening) {
  const person = opening.person.isNew ? `${opening.person.name} is new in your album.` : `${opening.person.name} was already in your album.`;
  const completed = opening.teams.filter(({ justCompleted }) => justCompleted).map(({ name }) => `${name} team complete!`);
  const hoggie = `${rarityWords[opening.hoggie.rarity]} hoggie: ${opening.hoggie.name}, ${opening.hoggie.isNew ? "new" : `copy ${opening.hoggie.copy}`}.`;
  return [person, ...completed, hoggie].join(" ");
}

function NoPacks() {
  return (
    <section className="ty-opening ty-no-packs">
      <Envelope pack={null} name="" />
      <h1 className="ty-title">No packs waiting</h1>
      <p className="ty-muted">Give a thoughtful kudos in Slack: thank someone and say why. Each one earns a pack, one per teammate a week.</p>
      <p className="ty-muted ty-small">In this prototype, use the Pretend Slack dock at the bottom left.</p>
      <AppLink href="/" className="ty-link">
        Back to your people
      </AppLink>
    </section>
  );
}

function Sealed({ album, pack, onBreak }: { album: Album; pack: Pack; onBreak: () => void }) {
  const person = album.people.find(({ key }) => key === pack.person);
  const name = person?.name ?? "a teammate";
  const others = album.packs.filter(({ id }) => id !== pack.id);
  return (
    <section className="ty-opening" aria-labelledby="ty-opening-title">
      <header className="ty-opening-head">
        <p className="ty-eyebrow">
          {album.packs.length === 1 ? "1 pack waiting" : `${album.packs.length} packs waiting`}
          {others.length > 0 ? ` · next: ${others.map(({ person: key }) => firstNameOf(album.people.find((entry) => entry.key === key)?.name ?? "")).join(", ")}` : ""}
        </p>
        <h1 id="ty-opening-title" className="ty-title">
          From your thank-you to {firstNameOf(name)}
        </h1>
        <p className="ty-muted">Sealed {whenOf(pack.earnedAt)}. Break the seal to see who's inside, and what's hiding behind them.</p>
      </header>
      <div className="ty-stage" data-phase="sealed">
        <button type="button" className="ty-seal-button" onClick={onBreak} aria-label={`Break the seal on ${firstNameOf(name)}'s pack`}>
          <Envelope pack={pack} name={name} />
        </button>
      </div>
      <div className="ty-finish">
        <button type="button" className="ty-button ty-button-warm" onClick={onBreak}>
          Break the seal
        </button>
      </div>
      <TeamStrip album={album} personKey={pack.person} teamKey={person?.teams[0]} holdingBack={person?.collectedAt === null ? pack.person : null} landed={false} />
    </section>
  );
}

function OpeningHead({ album, opening, phase }: { album: Album; opening: PackOpening; phase: Phase }) {
  const left = album.packs.length;
  return (
    <header className="ty-opening-head">
      <p className="ty-eyebrow">{reached(phase, "landed") ? (left === 0 ? "All packs opened" : `${left} more ${left === 1 ? "pack" : "packs"} waiting`) : "Opening a pack"}</p>
      <h1 id="ty-opening-title" className="ty-title">
        From your thank-you to {firstNameOf(opening.person.name)}
      </h1>
      <p className="ty-muted">{reached(phase, "ready") ? "" : "Click to skip ahead."}</p>
    </header>
  );
}

function Envelope({ pack, name }: { pack: Pack | null; name: string }) {
  return (
    <span className="ty-envelope" aria-hidden="true">
      <span className="ty-env-back" />
      <span className="ty-env-front" />
      <span className="ty-env-flap">
        {pack !== null && (
          <span className="ty-env-words">
            “{pack.message}”<span className="ty-env-to">to {name}</span>
          </span>
        )}
      </span>
      <span className="ty-env-seal">
        <HedgehogHeart size={36} className="ty-env-seal-hog" />
      </span>
    </span>
  );
}

function Polaroid({ opening }: { opening: PackOpening }) {
  return (
    <div className="ty-polaroid">
      <span className="ty-polaroid-photo">
        <MemberFace face={opening.person.face} className="ty-face" />
        <span className="ty-develop" />
      </span>
      <span className="ty-polaroid-name">{opening.person.name}</span>
    </div>
  );
}

function Reveal({ opening, phase }: { opening: PackOpening; phase: Phase }) {
  const developed = reached(phase, "developing");
  return (
    <div className="ty-reveal">
      <p className={`ty-reveal-kicker ${opening.person.isNew ? "ty-reveal-new" : ""}`}>{opening.person.isNew ? "New in your album" : "Already in your album"}</p>
      <p className="ty-reveal-name">{opening.person.name}</p>
      <p className="ty-reveal-line">{opening.person.isNew ? "Their portrait goes on their team page." : "Thanked again. Your history with them grows."}</p>
      <ul className="ty-reveal-teams">
        {opening.teams.map((team) => {
          const heldBefore = opening.person.isNew ? team.held - 1 : team.held;
          return (
            <li key={team.team} className="ty-reveal-team">
              <ProgressRing held={developed ? team.held : heldBefore} total={team.total} size={58} />
              <span>
                <span className="ty-reveal-team-name">{team.name}</span>
                {team.justCompleted ? <span className="ty-team-complete">Team complete!</span> : <span className="ty-muted ty-small">{team.total - team.held === 0 ? "Every face collected" : `${team.total - team.held} still to thank`}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const confetti = Array.from({ length: 26 }, (_, index) => {
  const angle = (index / 26) * Math.PI * 2;
  const reach = 90 + ((index * 37) % 70);
  return { dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach - 40), turn: (index * 47) % 360, light: index % 3 === 0 };
});

function HoggieReveal({ opening }: { opening: PackOpening }) {
  const shiny = isShiny(opening.hoggie.rarity);
  return (
    <div className={`ty-hoggie-pop ${shiny ? "ty-hoggie-pop-shiny" : ""}`}>
      <span className="ty-hoggie-halo" aria-hidden="true" />
      {shiny && (
        <span className="ty-confetti" aria-hidden="true">
          {confetti.map(({ dx, dy, turn, light }, index) => (
            <span key={index} className={`ty-confetto ${light ? "ty-confetto-light" : ""}`} style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--turn": `${turn}deg` } as CSSProperties} />
          ))}
        </span>
      )}
      <span className="ty-hoggie-art">
        <HoggieArt slug={opening.hoggie.hoggie} size={120} />
      </span>
      <span className="ty-hoggie-label">
        <span className="ty-hoggie-label-rarity">{rarityWords[opening.hoggie.rarity]} hoggie</span>
        <span className="ty-hoggie-label-name">{opening.hoggie.name}</span>
        <span className="ty-hoggie-label-copy">{opening.hoggie.isNew ? "New!" : `Copy #${opening.hoggie.copy}`}</span>
      </span>
    </div>
  );
}

function Finish({ album, opening, phase, onPutInAlbum, onNext }: { album: Album; opening: PackOpening; phase: Phase; onPutInAlbum: () => void; onNext: () => void }) {
  const team = opening.teams[0];
  if (!reached(phase, "ready")) return <div className="ty-finish" />;
  if (phase !== "landed")
    return (
      <div className="ty-finish">
        <button type="button" className="ty-button ty-button-warm" onClick={onPutInAlbum} disabled={phase === "landing"}>
          Put {firstNameOf(opening.person.name)} in the album
        </button>
        <span className="ty-muted ty-small">
          +{opening.xp.gained} XP{opening.xp.levelAfter > opening.xp.levelBefore ? ` · Level ${opening.xp.levelAfter}` : ""}
        </span>
      </div>
    );
  return (
    <div className="ty-finish">
      {album.packs.length > 0 && (
        <button type="button" className="ty-button ty-button-warm" onClick={onNext}>
          Open the next pack ({album.packs.length} left)
        </button>
      )}
      {team !== undefined && (
        <AppLink href={`/book#teams/${team.team}`} onFollow={onNext} className={`ty-button ${album.packs.length > 0 ? "ty-button-quiet" : "ty-button-warm"}`}>
          See the {team.name} page
        </AppLink>
      )}
      <AppLink href={`/book#people/${opening.person.key}`} onFollow={onNext} className="ty-button ty-button-quiet">
        {firstNameOf(opening.person.name)}'s page
      </AppLink>
    </div>
  );
}

function TeamStrip({ album, personKey, teamKey, holdingBack, landed }: { album: Album; personKey: string; teamKey: string | undefined; holdingBack: string | null; landed: boolean }) {
  const team = album.teams.find(({ team: key }) => key === teamKey);
  if (team === undefined) return null;
  const teammates = teammatesOf(album, team, holdingBack);
  const held = teammates.filter(({ collected }) => collected).length;
  const completeNow = held === team.total;
  const shown = withTheTarget(teammates.slice(0, stripSize), teammates, personKey);
  return (
    <section className="ty-strip" data-landed={landed} aria-label={`${team.name} team page`}>
      <span className="ty-strip-label">
        <CrestArt art={team.art} size={34} name={team.name} collected={held > 0} />
        <span>
          <span className="ty-strip-name">{team.name}</span>
          <span className="ty-count">
            <strong>{held}</strong>/{team.total}
          </span>
        </span>
        {completeNow && <Ribbon small />}
      </span>
      <ul className="ty-strip-faces">
        {shown.map(({ person, collected }) => (
          <li key={person.key} data-key={person.key} className={person.key === personKey ? "ty-strip-target" : ""}>
            <Portrait face={person.face} name={person.name} collected={collected} size={46} />
          </li>
        ))}
        {teammates.length > stripSize && <li className="ty-strip-more">+{teammates.length - stripSize}</li>}
      </ul>
    </section>
  );
}

const stripSize = 12;

function withTheTarget<Shown extends { person: { key: string } }>(shown: Shown[], all: Shown[], key: string) {
  if (shown.some(({ person }) => person.key === key)) return shown;
  const target = all.find(({ person }) => person.key === key);
  return target === undefined ? shown : [...shown.slice(0, -1), target];
}
