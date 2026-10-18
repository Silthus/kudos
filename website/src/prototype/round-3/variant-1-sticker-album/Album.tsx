// PROTOTYPE (#625, round 3): the open sticker album: fixed-size spreads, paper page turns, edge tabs, a sticker's back and the stick-it-in landing. Never merge to main.
import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import type { Album as AlbumData, Person } from "../album";
import { CrestArt } from "../../art";
import { AppLink } from "../../../AppLink";
import { dateWords, firstNameOf, hrefOfSpread, motionMs, rarityWords, reducedMotion, type Landing, type Spread } from "./model";
import { Page, type PageContext } from "./Pages";
import { PersonSticker } from "./Stickers";

type Turn = { from: number; to: number; id: number };

type AlbumProps = {
  album: AlbumData;
  spreads: Spread[];
  numbers: Map<string, number>;
  index: number;
  person: string | null;
  phone: boolean;
  landing: Landing | null;
  onFlip: (index: number) => void;
  onOpenPerson: (key: string) => void;
  onClosePerson: () => void;
  onLandingNext: () => void;
  onLandingDone: () => void;
};

export function OpenAlbum({ album, spreads, numbers, index, person, phone, landing, onFlip, onOpenPerson, onClosePerson, onLandingNext, onLandingDone }: AlbumProps) {
  const [shown, setShown] = useState(index);
  const [turn, setTurn] = useState<Turn | null>(null);
  const settled = turn?.to ?? shown;

  useLayoutEffect(() => {
    if (index === settled) return;
    if (reducedMotion || phone) {
      setShown(index);
      setTurn(null);
      return;
    }
    setTurn({ from: settled, to: index, id: Date.now() });
  }, [index, settled, phone]);

  const ticked = useTicked(landing, turn === null && landingIsOn(landing, spreads[shown]));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, select, textarea")) return;
      if (event.key === "Escape" && person !== null) onClosePerson();
      if (person !== null) return;
      if (event.key === "ArrowRight" && index < spreads.length - 1) onFlip(index + 1);
      if (event.key === "ArrowLeft" && index > 0) onFlip(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, person, spreads.length, onFlip, onClosePerson]);

  const context: PageContext = { album, spreads, numbers, landing, ticked, onOpenPerson };
  const page = (at: number, side: "left" | "right") => <Page key={`${at}-${side}`} spread={spreads[at]!} index={at} side={side} context={context} />;
  const forward = turn !== null && turn.to > turn.from;
  const left = turn === null ? shown : forward ? turn.from : turn.to;
  const right = turn === null ? shown : forward ? turn.to : turn.from;
  const opened = person === null ? undefined : album.people.find(({ key }) => key === person);

  return (
    <div className={`sa-book ${phone ? "sa-book-phone" : ""}`}>
      <div className="sa-spread">
        {page(left, "left")}
        {page(right, "right")}
        <span className="sa-spine" aria-hidden="true" />
        {turn !== null && (
          <div
            key={turn.id}
            className={`sa-leaf ${forward ? "sa-leaf-forward" : "sa-leaf-back"}`}
            onAnimationEnd={(event) => {
              if (event.target !== event.currentTarget) return;
              setShown(turn.to);
              setTurn(null);
            }}
          >
            <div className="sa-leaf-face sa-leaf-front">{forward ? page(turn.from, "right") : page(turn.from, "left")}</div>
            <div className="sa-leaf-face sa-leaf-reverse">{forward ? page(turn.to, "left") : page(turn.to, "right")}</div>
          </div>
        )}
        {!phone && (
          <>
            <button type="button" className="sa-corner sa-corner-left" disabled={index === 0} onClick={() => onFlip(index - 1)} aria-label="Previous page">
              ‹
            </button>
            <button type="button" className="sa-corner sa-corner-right" disabled={index === spreads.length - 1} onClick={() => onFlip(index + 1)} aria-label="Next page">
              ›
            </button>
          </>
        )}
      </div>
      {phone && <PhoneFlip index={index} count={spreads.length} onFlip={onFlip} />}
      {!phone && <Tabs spreads={spreads} index={settled} />}
      {opened !== undefined && <PersonCard person={opened} album={album} spreads={spreads} numbers={numbers} onClose={onClosePerson} />}
      {landing !== null && ticked && turn === null && landingIsOn(landing, spreads[shown]) && <LandingNote landing={landing} album={album} onNext={onLandingNext} onDone={onLandingDone} />}
    </div>
  );
}

function landingIsOn(landing: Landing | null, spread: Spread | undefined) {
  if (landing === null || spread === undefined) return false;
  if (landing.step === "person") return spread.kind === "team" && spread.team.team === landing.team;
  return spread.kind === "hoggies" && spread.rarity === landing.opening.hoggie.rarity;
}

function useTicked(landing: Landing | null, on: boolean) {
  const key = landing === null ? null : `${landing.opening.pack.id}:${landing.step}`;
  const [tickedKey, setTickedKey] = useState<string | null>(null);
  useEffect(() => {
    if (key === null || !on) return;
    const timer = window.setTimeout(() => setTickedKey(key), motionMs(1250));
    return () => window.clearTimeout(timer);
  }, [key, on]);
  return key !== null && tickedKey === key;
}

function Tabs({ spreads, index }: { spreads: Spread[]; index: number }) {
  const current = spreads[index];
  const tabs = spreads.flatMap((spread, at) => {
    if (spread.kind === "hoggies" && spread.rarity !== "common") return [];
    return [{ spread, at }];
  });
  return (
    <nav className="sa-tabs" aria-label="Album sections">
      {tabs.map(({ spread, at }) => {
        const active = spread.kind === "hoggies" ? current?.kind === "hoggies" : at === index;
        const label = spread.kind === "team" ? spread.team.name : spread.kind === "hoggies" ? "Hoggies" : spread.kind === "records" ? "Records" : "Contents";
        const style = { "--tab": spread.kind === "team" ? spread.colour : spread.kind === "hoggies" ? "var(--rarity-epic)" : spread.kind === "records" ? "#B17816" : "#23251D" } as CSSProperties;
        return (
          <AppLink key={at} href={spread.kind === "hoggies" ? "/book#hoggies" : hrefOfSpread(spread)} className={`sa-tab ${active ? "sa-tab-active" : ""} ${spread.kind === "team" ? "sa-tab-team" : ""}`} style={style} aria-current={active ? "page" : undefined} title={label}>
            {spread.kind === "team" ? (
              <>
                <CrestArt art={spread.team.art} size={24} name={spread.team.name} />
                <span className="sa-visually-hidden">{label}</span>
              </>
            ) : (
              <span className="sa-tab-word">{label}</span>
            )}
          </AppLink>
        );
      })}
    </nav>
  );
}

function PhoneFlip({ index, count, onFlip }: { index: number; count: number; onFlip: (index: number) => void }) {
  return (
    <div className="sa-phone-flip">
      <button type="button" disabled={index === 0} onClick={() => onFlip(index - 1)}>
        ‹ Previous
      </button>
      <span>
        Spread {index + 1} of {count}
      </span>
      <button type="button" disabled={index === count - 1} onClick={() => onFlip(index + 1)}>
        Next ›
      </button>
    </div>
  );
}

function PersonCard({ person, album, spreads, numbers, onClose }: { person: Person; album: AlbumData; spreads: Spread[]; numbers: Map<string, number>; onClose: () => void }) {
  const team = album.teams.find(({ team: key }) => key === person.teams[0]);
  const spread = spreads.find((entry) => entry.kind === "team" && entry.team.team === team?.team);
  const colour = spread?.kind === "team" ? spread.colour : "#F54E00";
  const number = team === undefined ? null : (numbers.get(`${team.team}:${person.key}`) ?? null);
  const held = person.collectedAt !== null;
  const teams = person.teams.map((key) => album.teams.find(({ team: entry }) => entry === key)?.name ?? key);
  const captain = album.teams.some((entry) => person.teams.includes(entry.team) && entry.leads.includes(person.name));
  return (
    <div className="sa-card-scrim" onClick={onClose}>
      <div className="sa-card-stage" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={`${person.name}'s card`}>
        <div className="sa-card-flip">
          <div className="sa-card-face sa-card-front">
            {held ? (
              <PersonSticker person={person} number={number} look={{ width: 340, colour, captain }} teamName={team?.name ?? ""} />
            ) : (
              <span className="sa-slot-print sa-card-missing">
                <span className="sa-slot-print-number">{number}</span>
                <span className="sa-slot-print-name">{person.name}</span>
              </span>
            )}
          </div>
          <div className="sa-card-face sa-card-reverse">
            <header className="sa-back-head">
              <span className="sa-back-number">{number !== null ? `No. ${number}` : ""}</span>
              <h2>{person.name}</h2>
              <p>
                {person.role ?? "Teammate"}
                {captain ? " · Captain" : ""}
              </p>
              <p className="sa-back-teams">{teams.join(" · ")}</p>
            </header>
            {held ? (
              <dl className="sa-back-stats">
                <div>
                  <dt>First thanked</dt>
                  <dd>{person.stats.firstThankedAt === null ? "Not yet" : dateWords(person.stats.firstThankedAt)}</dd>
                </div>
                <div>
                  <dt>Kudos</dt>
                  <dd>
                    you gave <b>{person.stats.kudosGiven}</b> · got <b>{person.stats.kudosReceived}</b>
                  </dd>
                </div>
                <div>
                  <dt>Hugs</dt>
                  <dd>
                    you gave <b>{person.stats.hugsGiven}</b> · got <b>{person.stats.hugsReceived}</b>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="sa-back-missing">
                Not in your album yet. Thank {firstNameOf(person.name)} in Slack and say why: their sticker comes in the pack.
                {person.stats.hugsGiven + person.stats.hugsReceived > 0 && (
                  <span className="sa-back-hugs">
                    Hugs so far: you gave {person.stats.hugsGiven} · got {person.stats.hugsReceived}
                  </span>
                )}
              </p>
            )}
            {person.stats.bestMessage !== null && (
              <figure className="sa-back-quote">
                <figcaption>Your best message</figcaption>
                <blockquote>“{person.stats.bestMessage}”</blockquote>
              </figure>
            )}
          </div>
        </div>
        <button type="button" className="sa-card-close" onClick={onClose}>
          Back to the page
        </button>
      </div>
    </div>
  );
}

function LandingNote({ landing, album, onNext, onDone }: { landing: Landing; album: AlbumData; onNext: () => void; onDone: () => void }) {
  const { opening } = landing;
  const team = opening.teams.find(({ team: key }) => key === landing.team);
  const more = album.packs.length;
  if (landing.step === "person") {
    return (
      <div className="sa-landing-note" role="status">
        <p>
          <b>{opening.person.name}</b> is in your album.{" "}
          {team !== undefined && (team.justCompleted ? <b className="sa-landing-complete">{team.name} page complete!</b> : `${team.name}: ${team.held} of ${team.total}.`)}
        </p>
        <button type="button" className="sa-button" onClick={onNext}>
          Next: your hoggie →
        </button>
      </div>
    );
  }
  return (
    <div className="sa-landing-note" role="status">
      <p>
        <b>{opening.hoggie.name}</b> · {rarityWords[opening.hoggie.rarity]} · {opening.hoggie.isNew ? "new in your album" : `copy #${opening.hoggie.copy}`}
      </p>
      {more > 0 ? (
        <AppLink href="/book#packs" className="sa-button" onFollow={onDone}>
          Open the next pack ({more} left)
        </AppLink>
      ) : (
        <button type="button" className="sa-button" onClick={onDone}>
          Done
        </button>
      )}
    </div>
  );
}
