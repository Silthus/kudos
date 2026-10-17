// PROTOTYPE (#625): the Tome of Hoggies overlay: a fixed-size two-page book with rarity and team chapters, flipped with ←/→. Never merge to main.
import { useCallback, useEffect, useMemo, useReducer, useState, type CSSProperties } from "react";
import { useNavigate } from "../../AppLink";
import type { CollectionHoggie, CollectionTeamPerson } from "../../collectionRead";
import { prefersReducedMotion } from "../../reducedMotion";
import { CrestArt, HoggieArt, MemberFace } from "../art";
import { rarityColour, rarityOrder, type World } from "../world";
import { rarityLabel } from "./sheet";
import { spreadIndexAt, spreadsOf, type HoggieSpread, type Spread, type TeamSpread } from "./tomeSpreads";

type Turn = { way: "forward" | "back"; serial: number };

export function Tome({ world }: { world: World }) {
  const navigate = useNavigate();
  const spreads = useMemo(() => spreadsOf(world), [world]);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [turn, setTurn] = useState<Turn | null>(null);
  const index = spreadIndexAt(spreads, window.location.hash);
  const spread = spreads[index]!;

  const goTo = useCallback(
    (next: number) => {
      const target = spreads[Math.min(spreads.length - 1, Math.max(0, next))];
      if (target === undefined || target === spreads[index]) return;
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${target.hash}`);
      if (!prefersReducedMotion()) setTurn((current) => ({ way: next > index ? "forward" : "back", serial: (current?.serial ?? 0) + 1 }));
      rerender();
    },
    [spreads, index],
  );

  const close = useCallback(() => navigate("/"), [navigate]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight") goTo(index + 1);
      else if (event.key === "ArrowLeft") goTo(index - 1);
      else if (event.key === "Escape") close();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, close]);

  const chapters = [...rarityOrder.map((rarity) => ({ chapter: rarity as Spread["chapter"], label: rarityLabel[rarity], colour: rarityColour[rarity] })), { chapter: "teams" as const, label: "Teams", colour: "#7a5a1e" }];

  return (
    <div className="v4-tome-backdrop" role="dialog" aria-modal="true" aria-label="Tome of Hoggies" onClick={(event) => event.target === event.currentTarget && close()}>
      <div className="v4-tome">
        <nav className="v4-tome-chapters" aria-label="Chapters">
          {chapters.map(({ chapter, label, colour }) => (
            <button key={chapter} type="button" className="v4-tome-chapter" aria-current={spread.chapter === chapter} style={{ "--chapter": colour } as CSSProperties} onClick={() => goTo(spreads.findIndex((each) => each.chapter === chapter))}>
              {label}
            </button>
          ))}
        </nav>
        <div className="v4-tome-pages">
          {spread.kind === "hoggies" ? <HoggiePages spread={spread} /> : <TeamPages spread={spread} world={world} onTeam={(hash) => goTo(spreads.findIndex((each) => each.hash === hash))} />}
          {turn !== null && <span key={turn.serial} className={`v4-leaf v4-leaf-${turn.way}`} aria-hidden="true" onAnimationEnd={() => setTurn(null)} />}
        </div>
        <footer className="v4-tome-foot">
          <button type="button" className="v4-tome-flip" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous page">
            ◀
          </button>
          <span>
            Spread {index + 1} of {spreads.length} · ←/→ to turn
          </span>
          <button type="button" className="v4-tome-flip" onClick={() => goTo(index + 1)} disabled={index === spreads.length - 1} aria-label="Next page">
            ▶
          </button>
        </footer>
        <button type="button" className="v4-tome-close" onClick={close}>
          Close ✕
        </button>
      </div>
    </div>
  );
}

function HoggiePages({ spread }: { spread: HoggieSpread }) {
  const [left, right] = spread.pages;
  const owned = [...left, ...right].filter(({ count }) => count > 0).length;
  return (
    <>
      <article className="v4-page v4-page-left">
        <PageHead title={`${rarityLabel[spread.chapter]} hoggies`} colour={rarityColour[spread.chapter]} detail={`${owned} of ${left.length + right.length} on this spread`} />
        <HoggieGrid hoggies={left} />
        <p className="v4-page-number">{spread.number * 2 - 1}</p>
      </article>
      <article className="v4-page v4-page-right">
        <PageHead title={spread.of > 1 ? `Part ${spread.number} of ${spread.of}` : ""} colour={rarityColour[spread.chapter]} detail="" />
        <HoggieGrid hoggies={right} />
        <p className="v4-page-number">{spread.number * 2}</p>
      </article>
    </>
  );
}

function PageHead({ title, colour, detail }: { title: string; colour: string; detail: string }) {
  return (
    <header className="v4-page-head">
      <h2 style={{ color: colour }}>{title}</h2>
      <span>{detail}</span>
    </header>
  );
}

function HoggieGrid({ hoggies }: { hoggies: CollectionHoggie[] }) {
  return (
    <ul className="v4-page-hoggies">
      {hoggies.map((hoggie) => {
        const missing = hoggie.count === 0;
        return (
          <li key={hoggie.hoggie} className={`v4-page-hoggie ${missing ? "v4-page-hoggie-missing" : ""}`} style={{ "--glow": rarityColour[hoggie.rarity] } as CSSProperties}>
            <HoggieArt slug={hoggie.hoggie} size={64} silhouette={missing} />
            <span>{missing ? "Not found yet" : hoggie.name}</span>
            {hoggie.count > 1 && <small>×{hoggie.count}</small>}
          </li>
        );
      })}
    </ul>
  );
}

function TeamPages({ spread, world, onTeam }: { spread: TeamSpread; world: World; onTeam: (hash: string) => void }) {
  const { team } = spread;
  const leads = team.people.filter(({ lead }) => lead).map(({ name }) => name);
  return (
    <>
      <article className="v4-page v4-page-left v4-team-left">
        <PageHead title="Team page" colour="#7a5a1e" detail={team.mine ? "Your team" : ""} />
        <div className="v4-team-crest">
          <CrestArt art={team.art} size={150} name={team.name} collected={team.complete || team.crest !== null} />
          {team.complete && <span className="v4-team-stamp">Complete</span>}
        </div>
        <h3 className="v4-team-name">{team.name}</h3>
        <p className="v4-team-count">
          {team.held} of {team.total} teammates thanked
        </p>
        <span className="v4-xp v4-team-bar">
          <span style={{ width: `${team.total === 0 ? 0 : (team.held / team.total) * 100}%` }} />
        </span>
        {leads.length > 0 && <p className="v4-team-leads">Led by {leads.join(" and ")}</p>}
        <div className="v4-team-chips">
          {world.teams.map((each) => (
            <button key={each.team} type="button" className="v4-team-chip" aria-current={each.team === team.team} onClick={() => onTeam(`#teams/${each.team}`)} title={each.name}>
              <CrestArt art={each.art} size={28} name={each.name} collected={each.complete || each.crest !== null} />
            </button>
          ))}
        </div>
      </article>
      <article className="v4-page v4-page-right">
        <PageHead title={spread.of > 1 ? `Teammates, part ${spread.number}` : "Teammates"} colour="#7a5a1e" detail="One sticker per teammate you thank" />
        <ul className={`v4-page-people ${spread.people.length > 16 ? "v4-page-people-crowded" : ""}`} style={{ "--people-columns": spread.people.length > 16 ? 5 : spread.people.length > 9 ? 4 : 3 } as CSSProperties}>
          {spread.people.map((person) => (
            <TeammateSlot key={person.key} person={person} roomy={spread.people.length <= 16} />
          ))}
        </ul>
      </article>
    </>
  );
}

function TeammateSlot({ person, roomy }: { person: CollectionTeamPerson; roomy: boolean }) {
  return (
    <li className={`v4-page-person ${person.held ? "" : "v4-page-person-missing"}`} title={person.role === null ? person.name : `${person.name}, ${person.role}`}>
      <span className="v4-page-person-face">{person.held ? <MemberFace face={person.face} className="v4-face" /> : <span className="v4-face v4-face-missing">?</span>}</span>
      <span className="v4-page-person-name">
        {person.lead && "★ "}
        {roomy ? person.name : person.name.split(" ")[0]}
      </span>
      {roomy && person.role !== null && <small className="v4-page-person-role">{person.role}</small>}
    </li>
  );
}
