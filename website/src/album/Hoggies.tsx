import { useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnswerPage } from "../pages/AnswerPage";
import { PageTitle } from "../PageTitle";
import { LoadingPage } from "../pages/LoadingPage";
import type { Rarity } from "../shell";
import type { AlbumHoggie, AlbumHoggies, HoggiesShown, PetReply } from "./answer";
import { HoggieArt } from "./HoggieArt";
import type { HoggieAddress } from "./hoggieAddress";
import { HoggieEntry } from "./HoggieEntry";
import { copiesWords, filterKeys, filters, groupIdOf, hoggieLabelOf, keptBy, numberOf, rarityTintOf, shelvesOf, withoutOneCopyOf, type Filter, type Shelf } from "./hoggieGuide";
import { rarityWordOf } from "./opening";
import { dateOf } from "./teamPage";
import { landedMarksOf, useBroughtIntoViewOnLanding, useLanding } from "./useItemBoard";
import { LandedHype } from "./ItemBoard";
import { NewSinceTheLastVisit, useNewSinceTheLastVisit } from "./newLabels";
import type { Forging } from "./useForge";
import { usePetPick } from "./usePetPick";
import { useRarityStrip } from "./useRarityStrip";
import "./hoggies.css";

type HoggiesPlace = { hoggie: string | null; rarity?: Rarity };

type MakePet = (hoggie: string) => Promise<PetReply>;

type HoggiesAnswerProps = { shown: HoggiesShown | undefined; place: HoggiesPlace; address: HoggieAddress; makePet: MakePet; forging: Forging; onSignIn: () => void; onSignOut: () => void };

export function HoggiesAnswerPage({ shown, place, address, makePet, forging, ...answers }: HoggiesAnswerProps) {
  if (shown === undefined || shown.kind === "off") return <LoadingPage shape="column" />;
  if (shown.kind !== "hoggies") return <AnswerPage answer={shown} {...answers} />;
  return <HoggiesPage answer={shown} place={place} address={address} makePet={makePet} forging={forging} />;
}

export function isWaitingForTheHoggies(shown: HoggiesShown | undefined) {
  return shown === undefined;
}

type Open = (hoggie: AlbumHoggie) => void;

function HoggiesPage({ answer: answered, place, address, makePet, forging: forgingAnywhere }: { answer: AlbumHoggies; place: HoggiesPlace; address: HoggieAddress; makePet: MakePet; forging: Forging }) {
  const answer = useWithoutTheArrivingFind(answered);
  const [filter, setFilter] = useFilterShowingEachLanding();
  const shown = keptBy(filter, answer.hoggies, place.rarity);
  const chosen = answer.hoggies.find(({ hoggie }) => hoggie === place.hoggie) ?? null;
  const open: Open = (hoggie) => address.open(hoggie.hoggie);
  const picking = usePetPick(answer.pet, makePet);
  const forging = answer.forge !== undefined ? forgingAnywhere : null;
  return (
    <article className="al-page-body al-hoggies">
      <Header answer={answer} />
      <RarestFinds answer={answer} onOpen={open} />
      <Collection answer={answer} shown={shown} filter={filter} rarity={place.rarity} onFilter={setFilter} onShowEveryRarity={address.showEveryRarity} onOpen={open} />
      {chosen !== null && <HoggieEntry hoggie={chosen} answer={answer} picking={picking} forging={forging} steps={answer.hoggies.filter((hoggie) => hoggie === chosen || shown.includes(hoggie))} onStep={(hoggie) => address.step(hoggie.hoggie)} onClose={address.close} />}
    </article>
  );
}

function useFilterShowingEachLanding() {
  const landedTurn = useLanding()?.turn ?? null;
  const [filter, setFilter] = useState<Filter>("all");
  const [filteredSince, setFilteredSince] = useState(landedTurn);
  if (filteredSince !== landedTurn) {
    setFilteredSince(landedTurn);
    setFilter("all");
  }
  return [filter, setFilter] as const;
}

function Header({ answer }: { answer: AlbumHoggies }) {
  const legendaries = answer.rarities.find(({ rarity }) => rarity === "legendary")?.total ?? 0;
  return (
    <header className="al-hoggies-head">
      <p className="al-eyebrow">Surprises</p>
      <PageTitle tab="Hoggies" size="hero">
        Hoggies
      </PageTitle>
      <p className="al-lede">{`Every kudos you give earns a hoggie, one per person you thank each week. You've found ${answer.found} of ${answer.total}, from the everyday commons to the ${legendaries} legendaries.`}</p>
    </header>
  );
}

function RarestFinds({ answer, onOpen }: { answer: AlbumHoggies; onOpen: Open }) {
  const title = useId();
  return (
    <div className="al-hoggies-case">
      <section className="al-hoggies-glass" aria-labelledby={title}>
        <p className="al-hoggies-glass-label">
          <strong id={title}>Rarest finds</strong>
          <span>The top shelf fills itself</span>
        </p>
        {answer.rarest.length === 0 ? (
          <p className="al-hoggies-glass-empty">Every kudos you give earns a hoggie, one per person you thank each week. Your rarest finds stand here.</p>
        ) : (
          <ul className="al-hoggies-plinths">
            {answer.rarest.map((hoggie) => (
              <li key={hoggie.hoggie}>
                <button type="button" className="al-hoggies-plinth" style={rarityTintOf(hoggie.rarity)} aria-label={hoggieLabelOf(hoggie)} onClick={() => onOpen(hoggie)}>
                  <span className="al-hoggies-plinth-glow">
                    <HoggieArt hoggie={hoggie.hoggie} hidden={false} />
                  </span>
                  <span className="al-hoggies-plinth-name">{hoggie.name}</span>
                  <span className="al-hoggies-rarity">{rarityWordOf(hoggie.rarity)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Notes answer={answer} onOpen={onOpen} />
    </div>
  );
}

function Notes({ answer, onOpen }: { answer: AlbumHoggies; onOpen: Open }) {
  const found = answer.hoggies.filter((hoggie) => hoggie.found);
  const latest = found.toSorted((one, other) => (other.firstAt ?? 0) - (one.firstAt ?? 0))[0];
  const mostCopies = found.toSorted((one, other) => other.count - one.count)[0];
  return (
    <div className="al-hoggies-notes">
      <p className="al-hoggies-note">
        <strong className="al-hoggies-note-total">{answer.found}</strong>
        <span className="al-hoggies-note-words">
          <strong>{`of ${answer.total} found`}</strong>
          <span className="al-hoggies-quiet">{`${answer.total - answer.found} still hidden`}</span>
        </span>
      </p>
      {latest !== undefined && latest.firstAt !== null && <NoteAbout hoggie={latest} heading="Latest find" detail={dateOf(latest.firstAt)} onOpen={onOpen} />}
      {mostCopies !== undefined && mostCopies.count > 1 && <NoteAbout hoggie={mostCopies} heading="Most copies" detail={copiesWords(mostCopies.count)} onOpen={onOpen} />}
    </div>
  );
}

function NoteAbout({ hoggie, heading, detail, onOpen }: { hoggie: AlbumHoggie; heading: string; detail: string; onOpen: Open }) {
  return (
    <button type="button" className="al-hoggies-note" onClick={() => onOpen(hoggie)}>
      <HoggieArt hoggie={hoggie.hoggie} hidden={false} />
      <span className="al-hoggies-note-words">
        <span className="al-hoggies-quiet">{heading}</span>
        <strong>{hoggie.name}</strong>
        <span className="al-hoggies-quiet">{detail}</span>
      </span>
    </button>
  );
}

type CollectionProps = { answer: AlbumHoggies; shown: AlbumHoggie[]; filter: Filter; rarity: Rarity | undefined; onFilter: (filter: Filter) => void; onShowEveryRarity: () => void; onOpen: Open };

function Collection({ answer, shown, filter, rarity, onFilter, onShowEveryRarity, onOpen }: CollectionProps) {
  const title = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const groups = shelvesOf(answer, shown).filter(({ hoggies }) => hoggies.length > 0);
  const strip = useRarityStrip(groups, bar);
  const jumpTo = (target: Rarity) => {
    if (rarity !== undefined && rarity !== target) onShowEveryRarity();
    if (!keptBy(filter, answer.hoggies).some((hoggie) => hoggie.rarity === target)) onFilter("all");
    strip.jump(target);
  };
  return (
    <section className="al-hoggies-collection" style={landingLineOf(strip.line)} aria-labelledby={title}>
      <div ref={bar} className="al-hoggies-bar">
        <div className="al-hoggies-bar-row">
          <h2 ref={heading} id={title} tabIndex={-1} className="al-hoggies-bar-title">
            The collection
          </h2>
          <div className="al-hoggies-filters" role="group" aria-label="Show">
            {filterKeys.map((key) => (
              <button key={key} type="button" className="al-hoggies-filter" aria-pressed={key === filter} onClick={() => onFilter(key)}>
                {filters[key].words}
                <small>{keptBy(key, answer.hoggies, rarity).length}</small>
              </button>
            ))}
          </div>
        </div>
        <RarityStrip shelves={shelvesOf(answer, answer.hoggies)} current={rarity ?? strip.current} onJump={jumpTo} />
        {rarity !== undefined && (
          <p className="al-hoggies-filtered">
            <span>{`Showing ${rarity} hoggies.`}</span>
            <button
              type="button"
              className="al-link-button"
              onClick={() => {
                heading.current?.focus({ preventScroll: true });
                onShowEveryRarity();
              }}
            >
              Show every rarity
            </button>
          </p>
        )}
      </div>
      {groups.length === 0 && <p className="al-hoggies-nothing">{filters[filter].none}</p>}
      {groups.map((group) => (
        <Group key={group.rarity} group={group} answer={answer} onOpen={onOpen} />
      ))}
    </section>
  );
}

function landingLineOf(line: number | null) {
  return line === null ? undefined : ({ "--al-hoggies-line": `${line}px` } as CSSProperties);
}

function RarityStrip({ shelves, current, onJump }: { shelves: Shelf[]; current: Rarity | null; onJump: (rarity: Rarity) => void }) {
  return (
    <nav className="al-hoggies-strip" aria-label="Found by rarity">
      {shelves.map((shelf) => {
        const words = rarityWordOf(shelf.rarity);
        return (
          <button
            key={shelf.rarity}
            type="button"
            className="al-hoggies-strip-part"
            style={{ ...rarityTintOf(shelf.rarity), "--al-share": shelf.total } as CSSProperties}
            aria-current={shelf.rarity === current ? "location" : undefined}
            aria-label={`${words}: ${shelf.found} of ${shelf.total} found. Jump there`}
            onClick={() => onJump(shelf.rarity)}
          >
            <span className="al-hoggies-strip-words">
              <strong>{words}</strong>
              <span>{`${shelf.found}/${shelf.total}`}</span>
            </span>
            <ShareBar part={shelf.found} whole={shelf.total} />
          </button>
        );
      })}
    </nav>
  );
}

function ShareBar({ part, whole }: { part: number; whole: number }) {
  return (
    <span className="al-hoggies-share" aria-hidden="true">
      <span style={{ width: `${(100 * part) / Math.max(1, whole)}%` }} />
    </span>
  );
}

function Group({ group, answer, onOpen }: { group: Shelf; answer: AlbumHoggies; onOpen: Open }) {
  const title = useId();
  return (
    <section id={groupIdOf(group.rarity)} className="al-hoggies-group" style={rarityTintOf(group.rarity)} aria-labelledby={title}>
      <div className="al-hoggies-group-head">
        <h3 id={title} tabIndex={-1} className="al-hoggies-group-title">
          {rarityWordOf(group.rarity)}
        </h3>
        <p className="al-hoggies-quiet">{`${group.found} of ${group.total} found · ${group.chance}% of rolls land here`}</p>
        <ShareBar part={group.found} whole={group.total} />
      </div>
      <ul className="al-hoggies-plates">
        {group.hoggies.map((hoggie) => (
          <li key={hoggie.hoggie}>
            <Plate hoggie={hoggie} number={numberOf(hoggie, answer)} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Plate({ hoggie, number, onOpen }: { hoggie: AlbumHoggie; number: string; onOpen: Open }) {
  const plate = useRef<HTMLButtonElement>(null);
  const landing = useLandingOf(hoggie);
  const foundSinceTheLastVisit = useNewSinceTheLastVisit(hoggie.firstAt);
  useBroughtIntoViewOnLanding(plate, landing);
  return (
    <button type="button" ref={plate} className="al-hoggies-plate" data-hoggie={hoggie.hoggie} {...landedMarksOf(landing)} data-found={hoggie.found ? "" : undefined} aria-label={foundSinceTheLastVisit ? `${hoggieLabelOf(hoggie)}, new` : hoggieLabelOf(hoggie)} onClick={() => onOpen(hoggie)}>
      <NewSinceTheLastVisit at={hoggie.firstAt} />
      <span className="al-hoggies-plate-number">{number}</span>
      {hoggie.count > 1 && <span className="al-hoggies-copies">{`×${hoggie.count}`}</span>}
      <span className="al-hoggies-plate-art">
        <HoggieArt hoggie={hoggie.hoggie} hidden={!hoggie.found} />
      </span>
      <span className="al-hoggies-plate-name">{hoggie.found ? hoggie.name : "Not found yet"}</span>
      <span className="al-hoggies-rarity">{rarityWordOf(hoggie.rarity)}</span>
      <LandedHype landing={landing} />
    </button>
  );
}

function useLandingOf(hoggie: AlbumHoggie) {
  const landing = useLanding();
  return landing?.face.kind === "hoggie" && landing.face.drop.hoggie === hoggie.hoggie ? landing : null;
}

function useWithoutTheArrivingFind(answer: AlbumHoggies): AlbumHoggies {
  const landing = useLanding();
  const arriving = landing?.phase === "arriving" && landing.face.kind === "hoggie" ? landing.face.drop.hoggie : null;
  return useMemo(() => (arriving === null ? answer : withoutOneCopyOf(answer, arriving)), [answer, arriving]);
}
