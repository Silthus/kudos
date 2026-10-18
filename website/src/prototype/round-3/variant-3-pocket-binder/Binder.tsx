// PROTOTYPE (#625, round 3): the open binder: nine-pocket sleeve spreads, page turns on the rings, index tabs and the lifted person card. Never merge to main.
import { useEffect, useState, type CSSProperties } from "react";
import { AppLink, useNavigate } from "../../../AppLink";
import { MemberFace } from "../../art";
import { personOf, type Album, type PackOpening, type Person } from "../album";
import { bookHref, hashOfSpread, pocketsPerSheet, rarityWords, sectionAt, sheetOfHoggie, teamColourOf, type Binder, type Sheet } from "./binderPages";
import { CrestCard, EmptyPocket, HoggieCard, MissingHoggie, PersonCard } from "./Cards";
import { clipped, firstNameOf, shortDate, useNarrowScreen, usePrefersReducedMotion } from "./motion";

type Turn = { from: number; to: number };

const turnMs = 640;

type BinderProps = { album: Album; binder: Binder; spread: number; lifted: string | null; landing: PackOpening | null; onLandingSeen: () => void; replaceTo: (href: string) => void };

export function OpenBinder({ album, binder, spread, lifted, landing, onLandingSeen, replaceTo }: BinderProps) {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const narrow = useNarrowScreen();
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnTo = (to: number, settle: () => void) => {
    if (to === spread || turn !== null || to < 0 || to >= binder.spreads) return;
    if (reduced || narrow) return settle();
    setTurn({ from: spread, to });
    window.setTimeout(() => {
      settle();
      setTurn(null);
    }, turnMs);
  };
  const flipTo = (to: number) => turnTo(to, () => replaceTo(bookHref(hashOfSpread(binder, to))));
  const jumpTo = (to: number, hash: string) => turnTo(to, () => navigate(bookHref(hash)));
  useArrowKeys(lifted === null, () => flipTo(spread - 1), () => flipTo(spread + 1));
  const current = sectionAt(binder, spread);
  const sheetAt = (index: number) => <SheetView key={index} sheet={binder.sheets[index]!} index={index} album={album} binder={binder} landing={landing} onJump={jumpTo} />;
  const forward = turn !== null && turn.to > turn.from;
  const left = turn === null ? spread * 2 : forward ? turn.from * 2 : turn.to * 2;
  const right = turn === null ? spread * 2 + 1 : forward ? turn.to * 2 + 1 : turn.from * 2 + 1;
  return (
    <div className="pb-binder-stage">
      <div className="pb-binder-open" data-turning={turn === null ? undefined : forward ? "forward" : "back"}>
        <div className="pb-spread">
          <div className="pb-sheet-slot pb-sheet-left">{sheetAt(left)}</div>
          <div aria-hidden="true" className="pb-rings">
            {Array.from({ length: 3 }, (_, ring) => (
              <span key={ring} className="pb-ring" />
            ))}
          </div>
          <div className="pb-sheet-slot pb-sheet-right">{sheetAt(right)}</div>
          {turn !== null && (
            <div aria-hidden="true" className={`pb-leaf ${forward ? "pb-leaf-forward" : "pb-leaf-back"}`}>
              <div className="pb-leaf-face">{sheetAt(forward ? turn.from * 2 + 1 : turn.from * 2)}</div>
              <div className="pb-leaf-face pb-leaf-face-back">{sheetAt(forward ? turn.to * 2 : turn.to * 2 + 1)}</div>
            </div>
          )}
          <button type="button" className="pb-turn pb-turn-prev" aria-label="Previous pages" disabled={spread === 0} onClick={() => flipTo(spread - 1)}>
            ‹
          </button>
          <button type="button" className="pb-turn pb-turn-next" aria-label="Next pages" disabled={spread === binder.spreads - 1} onClick={() => flipTo(spread + 1)}>
            ›
          </button>
        </div>
        <nav aria-label="Binder sections" className="pb-tabs">
          <button type="button" className="pb-tab" data-current={current === null ? "" : undefined} style={{ "--tab": "#23251D" } as CSSProperties} onClick={() => jumpTo(0, "")}>
            Contents
          </button>
          {binder.sections.map((section) => (
            <button key={section.id} type="button" className="pb-tab" data-current={current?.id === section.id ? "" : undefined} style={{ "--tab": section.colour } as CSSProperties} onClick={() => jumpTo(Math.floor(section.sheet / 2), section.id)}>
              {section.label}
            </button>
          ))}
        </nav>
      </div>
      {landing !== null && <LandingNote album={album} binder={binder} landing={landing} onJump={jumpTo} onDone={onLandingSeen} />}
      {lifted !== null && <LiftedCard album={album} person={personOf(album, lifted)!} />}
    </div>
  );
}

function useArrowKeys(active: boolean, onPrevious: () => void, onNext: () => void) {
  useEffect(() => {
    if (!active) return;
    const press = (event: KeyboardEvent) => {
      if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, select, textarea")) return;
      if (event.key === "ArrowLeft") onPrevious();
      if (event.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  });
}

type SheetProps = { sheet: Sheet; index: number; album: Album; binder: Binder; landing: PackOpening | null; onJump: (spread: number, hash: string) => void };

function SheetView({ sheet, index, album, binder, landing, onJump }: SheetProps) {
  return (
    <section className={`pb-sheet pb-sheet-${sheet.kind}`} aria-label={`Page ${index + 1}`}>
      <SheetBody sheet={sheet} album={album} binder={binder} landing={landing} onJump={onJump} />
      <span className="pb-page-number">{index + 1}</span>
    </section>
  );
}

function SheetBody({ sheet, album, binder, landing, onJump }: Omit<SheetProps, "index">) {
  if (sheet.kind === "cover") return <InsideCover album={album} />;
  if (sheet.kind === "contents") return <Contents binder={binder} onJump={onJump} />;
  if (sheet.kind === "blank") return <p className="pb-sheet-blank">Room for more pages.</p>;
  if (sheet.kind === "team") return <TeamSheet sheet={sheet} album={album} landing={landing} />;
  return <HoggieSheet sheet={sheet} landing={landing} />;
}

function SheetHeading({ title, count, colour }: { title: string; count: string; colour: string }) {
  return (
    <header className="pb-sheet-heading" style={{ "--tab": colour } as CSSProperties}>
      <span className="pb-sheet-title">{title}</span>
      <span className="pb-sheet-count">{count}</span>
    </header>
  );
}

function TeamSheet({ sheet, album, landing }: { sheet: Extract<Sheet, { kind: "team" }>; album: Album; landing: PackOpening | null }) {
  const navigate = useNavigate();
  const { team, colour } = sheet;
  const part = sheet.parts > 1 ? ` · ${sheet.part} of ${sheet.parts}` : "";
  return (
    <>
      <SheetHeading title={`${team.name}${part}`} count={`${team.held}/${team.total}`} colour={colour} />
      <ul className="pb-pockets">
        {sheet.pockets.map((pocket) => {
          if (pocket.kind === "crest")
            return (
              <li key="crest" className="pb-pocket">
                <CrestCard team={team} colour={colour} />
              </li>
            );
          const person = personOf(album, pocket.key)!;
          const landed = landing?.person.key === person.key && landing.person.isNew;
          return (
            <li key={person.key} className="pb-pocket" data-landed={landed ? "" : undefined}>
              <button type="button" className="pb-pocket-button" aria-label={person.collectedAt === null ? `${person.name}, not collected yet` : `${person.name}, turn the card over`} onClick={() => navigate(bookHref(`people/${person.key}`))}>
                {person.collectedAt === null ? <EmptyPocket label={person.name} hint="Thank them to collect" /> : <PersonCard person={person} colour={colour} teamName={team.name} />}
              </button>
              {landed && <span className="pb-landed-tag">Just added</span>}
            </li>
          );
        })}
        <EmptySleeves filled={sheet.pockets.length} />
      </ul>
    </>
  );
}

function EmptySleeves({ filled }: { filled: number }) {
  return Array.from({ length: pocketsPerSheet - filled }, (_, index) => <li key={`sleeve-${index}`} aria-hidden="true" className="pb-pocket pb-pocket-unused" />);
}

function HoggieSheet({ sheet, landing }: { sheet: Extract<Sheet, { kind: "hoggies" }>; landing: PackOpening | null }) {
  const part = sheet.parts > 1 ? ` · ${sheet.part} of ${sheet.parts}` : "";
  return (
    <>
      <SheetHeading title={`${rarityWords[sheet.rarity]} hoggies${part}`} count={`${sheet.found}/${sheet.total}`} colour={`var(--rarity-${sheet.rarity})`} />
      <ul className="pb-pockets">
        {sheet.pockets.map((hoggie) => {
          const landed = landing?.hoggie.hoggie === hoggie.hoggie;
          return (
            <li key={hoggie.hoggie} className="pb-pocket" data-landed={landed ? "" : undefined}>
              {hoggie.count > 0 ? <HoggieCard hoggie={hoggie} /> : <MissingHoggie hoggie={hoggie} />}
              {hoggie.count > 1 && <span className="pb-copies">×{hoggie.count}</span>}
              {landed && <span className="pb-landed-tag">{landing.hoggie.isNew ? "Just added" : `Copy #${landing.hoggie.copy}`}</span>}
            </li>
          );
        })}
        <EmptySleeves filled={sheet.pockets.length} />
      </ul>
    </>
  );
}

function InsideCover({ album }: { album: Album }) {
  return (
    <div className="pb-inside-cover">
      <span className="pb-nameplate">
        <MemberFace face={album.me.face} className="pb-nameplate-face" />
        <span>
          <span className="pb-nameplate-label">This binder belongs to</span>
          <span className="pb-nameplate-name">{album.me.name}</span>
        </span>
      </span>
      <dl className="pb-cover-facts">
        <div>
          <dt>People collected</dt>
          <dd>
            {album.collected}
            <span className="pb-level-pin" title={`Level ${album.level.level}`}>
              Lv {album.level.level}
            </span>
          </dd>
        </div>
        <div>
          <dt>Team pages complete</dt>
          <dd>
            {album.teams.filter(({ complete }) => complete).length}/{album.teams.length}
          </dd>
        </div>
        <div>
          <dt>Hoggies found</dt>
          <dd>
            {album.hoggiesFound}/{album.hoggies.length}
          </dd>
        </div>
      </dl>
      <p className="pb-cover-how">Thank someone in Slack and say why. Each thoughtful kudos earns a pack: their card the first time, and a hoggie every time.</p>
      {album.packs.length > 0 && (
        <AppLink href="/book#packs" className="pb-button pb-button-primary">
          {album.packs.length === 1 ? "Open your pack" : `Open your ${album.packs.length} packs`}
        </AppLink>
      )}
    </div>
  );
}

function Contents({ binder, onJump }: { binder: Binder; onJump: (spread: number, hash: string) => void }) {
  const teams = binder.sections.filter(({ id }) => id.startsWith("teams/"));
  const hoggies = binder.sections.filter(({ id }) => id.startsWith("hoggies/"));
  const line = (section: (typeof teams)[number]) => (
    <li key={section.id}>
      <button type="button" className="pb-contents-line" onClick={() => onJump(Math.floor(section.sheet / 2), section.id)}>
        <span className="pb-contents-dot" style={{ background: section.colour }} />
        <span className="pb-contents-name">{section.label}</span>
        <span className="pb-contents-count">
          {section.complete && section.total > 0 ? "★ " : ""}
          {section.held}/{section.total}
        </span>
        <span className="pb-contents-leader" />
        <span className="pb-contents-page">p. {section.sheet + 1}</span>
      </button>
    </li>
  );
  return (
    <div className="pb-contents">
      <h2 className="pb-contents-title">Contents</h2>
      <h3 className="pb-contents-group">Team pages</h3>
      <ul>{teams.map(line)}</ul>
      <h3 className="pb-contents-group">Hoggies</h3>
      <ul>{hoggies.map(line)}</ul>
    </div>
  );
}

function LandingNote({ album, binder, landing, onJump, onDone }: { album: Album; binder: Binder; landing: PackOpening; onJump: (spread: number, hash: string) => void; onDone: () => void }) {
  const team = landing.teams[0];
  const hoggieSheet = sheetOfHoggie(binder, landing.hoggie.hoggie);
  const next = album.packs[0];
  return (
    <aside className="pb-landing" aria-live="polite">
      <span>
        {landing.person.isNew && team !== undefined ? (
          <>
            <strong>{landing.person.name}</strong> is in {team.name} · {team.justCompleted ? <strong className="pb-gold-word">Set complete!</strong> : `${team.held}/${team.total}`}
          </>
        ) : (
          <>
            <strong>{landing.hoggie.name}</strong> went into {rarityWords[landing.hoggie.rarity]}, page {hoggieSheet + 1}
          </>
        )}
      </span>
      {landing.person.isNew && (
        <button type="button" className="pb-link-button" onClick={() => onJump(Math.floor(hoggieSheet / 2), hashOfSpread(binder, Math.floor(hoggieSheet / 2)))}>
          See {landing.hoggie.name} (p. {hoggieSheet + 1})
        </button>
      )}
      {next !== undefined && (
        <AppLink href={`/book#packs/${next.id}`} className="pb-link-button">
          Next pack ({album.packs.length})
        </AppLink>
      )}
      <button type="button" className="pb-landing-close" aria-label="Dismiss" onClick={onDone}>
        ×
      </button>
    </aside>
  );
}

function LiftedCard({ album, person }: { album: Album; person: Person }) {
  const navigate = useNavigate();
  const [turned, setTurned] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => window.setTimeout(() => setTurned(true), 180));
    return () => window.cancelAnimationFrame(frame);
  }, [person.key]);
  const teamKey = person.teams[0]!;
  const team = album.teams.find((entry) => entry.team === teamKey)!;
  const colour = teamColourOf(album, teamKey);
  const close = () => navigate(bookHref(`teams/${teamKey}`));
  useEffect(() => {
    const press = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", press);
    return () => window.removeEventListener("keydown", press);
  });
  const collected = person.collectedAt !== null;
  return (
    <div className="pb-lift-scrim" onClick={(event) => event.target === event.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label={person.name} className="pb-lift">
        <div className="pb-lift-card" data-turned={turned ? "" : undefined} style={{ "--frame": colour } as CSSProperties}>
          <div className="pb-lift-face pb-lift-front">{collected ? <PersonCard person={person} colour={colour} teamName={team.name} size="big" /> : <EmptyPocket label={person.name} hint="Not in your binder yet" />}</div>
          <div className="pb-lift-face pb-lift-back">
            <PersonStats album={album} person={person} />
          </div>
        </div>
        <div className="pb-lift-actions">
          <button type="button" className="pb-button" onClick={() => setTurned(!turned)}>
            {turned ? "Show the front" : "Turn it over"}
          </button>
          <button type="button" className="pb-button pb-button-primary" onClick={close}>
            Back in the binder
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonStats({ album, person }: { album: Album; person: Person }) {
  const first = firstNameOf(person.name);
  const { stats } = person;
  return (
    <div className="pb-stats" style={{ "--frame": teamColourOf(album, person.teams[0]!) } as CSSProperties}>
      <header className="pb-stats-head">
        <MemberFace face={person.face} className="pb-stats-face" />
        <span>
          <span className="pb-stats-name">{person.name}</span>
          <span className="pb-stats-teams">{person.teams.map((key) => album.teams.find(({ team }) => team === key)?.name).join(" · ")}</span>
        </span>
      </header>
      <dl className="pb-stats-grid">
        <div className="pb-stats-wide">
          <dt>First thanked</dt>
          <dd>{stats.firstThankedAt === null ? "Not yet" : shortDate(stats.firstThankedAt)}</dd>
        </div>
        <div>
          <dt>Kudos you gave</dt>
          <dd>{stats.kudosGiven}</dd>
        </div>
        <div>
          <dt>Kudos from {first}</dt>
          <dd>{stats.kudosReceived}</dd>
        </div>
        <div>
          <dt>Hugs you gave</dt>
          <dd>{stats.hugsGiven}</dd>
        </div>
        <div>
          <dt>Hugs from {first}</dt>
          <dd>{stats.hugsReceived}</dd>
        </div>
      </dl>
      {stats.bestMessage !== null ? (
        <blockquote className="pb-flavour">
          “{clipped(stats.bestMessage, 140)}”<span>your best thank-you</span>
        </blockquote>
      ) : (
        <p className="pb-flavour pb-flavour-empty">Thank {first} in Slack and say why to earn their card.</p>
      )}
      {person.packedThisWeek && <p className="pb-stats-note">You've earned {first}'s pack this week. Next one after Monday.</p>}
    </div>
  );
}
