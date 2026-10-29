// PROTOTYPE (throwaway, branch prototype/book-explains-itself, never merged). Silthus/personal#220.
// Round 1: three variants of "the Book explains itself", switchable via ?variant=A|B|C:
// the next five milestones on the Book profile, a locked team page that says how to unlock its
// sticker and what it pays, and a sidebar with Hoggies and Milestones above the teams.
// Reward numbers are placeholders ("+?? XP"): they come to Michael once, in the spec park.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LadderEmblem } from "../book/LadderEmblem";
import { Medal } from "../book/Medal";
import { TeamCrest } from "../crates/TeamCrest";
import { PageTitle } from "../PageTitle";
import { SlackLink } from "../SlackLink";
import type { Album, AlbumPerson, AlbumTeam, MilestoneTierId } from "./answer";
import { plural, progressOf, teamsByProgress } from "./facts";
import { emblemOf, milestoneNameOf, tierEmojiOf } from "./milestones";
import { PersonPicture } from "./PersonPicture";
import { medalsInReachOf } from "./profile";
import { SealArt } from "./Seal";
import { ShareLink } from "./ShareLink";
import { firstNameOf, personIn } from "./teamPage";
import { bookVariants, chooseBookVariant, useBookVariant } from "./bookPrototypeVariant";
import { AppLink } from "../AppLink";
import { hrefOf } from "./place";
import type { MilestoneId } from "../../../convex/album/milestoneCatalogue";
import "./bookPrototype.css";

const slack = "slack://open";

const xpPlaceholder = "+?? XP";

type Step = { key: string; art: ReactNode; metal: MilestoneTierId | null; name: string; kind: string; count: number; goal: number; takes: string; pays: string[]; action: string };

function takesOf(milestone: MilestoneId, toGo: number) {
  switch (milestone) {
    case "people":
      return `Give a kudos to ${plural(toGo, "person", "people")} you haven't thanked yet`;
    case "teams":
      return `Collect everyone on ${plural(toGo, "more team", "more teams")}`;
    case "reach":
      return `Give a kudos to someone on a team not in your album yet (${toGo} to go)`;
    case "hoggies":
      return `Find ${plural(toGo, "hoggie", "hoggies")} you don't have yet: hugs and kudos both find them`;
    case "thoughtful":
      return `Give ${plural(toGo, "more kudos", "more kudos")}. Thanking the same person again counts`;
  }
}

function hoggiePayOf(metal: MilestoneTierId) {
  return metal === "bronze" ? "an uncommon or rare hoggie" : "a rare hoggie";
}

function medalStepsOf(album: Album): Step[] {
  return medalsInReachOf(album, null).map(({ milestone, tier }) => {
    const toGo = Math.max(0, tier.at - milestone.count);
    const best = milestone.tiers.findLast(({ earnedAt }) => earnedAt !== null)?.tier ?? null;
    return {
      key: `${milestone.id}:${tier.tier}`,
      art: <LadderEmblem ladder={emblemOf(milestone.id)} best={best} size={44} />,
      metal: tier.tier,
      name: tier.name,
      kind: milestoneNameOf(milestone.id),
      count: Math.min(milestone.count, tier.at),
      goal: tier.at,
      takes: takesOf(milestone.id, toGo),
      pays: [hoggiePayOf(tier.tier), `:${tierEmojiOf(album, milestone, tier).name}:`, xpPlaceholder],
      action: milestone.id === "hoggies" ? "Hug a message" : "Give a kudos",
    };
  });
}

function closestLockedTeamOf(album: Album) {
  return teamsByProgress(album.teams).find(({ state }) => state === "progress");
}

function missingOf(album: Album, team: AlbumTeam): AlbumPerson[] {
  return team.people.map((person) => personIn(album, person)).filter(({ held }) => !held);
}

function roadStepsOf(album: Album): Step[] {
  const level = album.level;
  const levelStep: Step = { key: "level", art: <span className="proto-level-badge">{level.level + 1}</span>, metal: null, name: `Level ${level.level + 1}`, kind: "Level", count: level.xp - level.startsAt, goal: level.nextAt - level.startsAt, takes: `Earn ${level.nextAt - level.xp} XP: every hug and kudos pays`, pays: ["a new level emoji", "an uncommon or rare hoggie"], action: "Hug a message" };
  const team = closestLockedTeamOf(album);
  const missing = team === undefined ? [] : missingOf(album, team);
  const teamStep: Step[] =
    team === undefined
      ? []
      : [{ key: `team:${team.team}`, art: <TeamCrest art={team.art} size={40} name={team.name} collected={false} />, metal: null, name: `${team.name} sticker`, kind: "Team sticker", count: team.held, goal: team.total, takes: `Give a kudos to ${missing.map(({ name }) => firstNameOf(name)).join(", ")}`, pays: ["a rare hoggie", `:team-${team.team}:`, xpPlaceholder], action: "Give a kudos" }];
  return [...teamStep, levelStep, ...medalStepsOf(album)].toSorted((one, other) => other.count / other.goal - one.count / one.goal).slice(0, 5);
}

export function NextMilestones({ album }: { album: Album }) {
  const variant = useBookVariant();
  if (variant === "A") return <MilestoneStrip steps={medalStepsOf(album).slice(0, 5)} />;
  if (variant === "B") return <UpNextList steps={medalStepsOf(album).slice(0, 5)} />;
  if (variant === "C") return <Road steps={roadStepsOf(album)} />;
  return null;
}

function Pays({ pays }: { pays: string[] }) {
  return (
    <ul className="proto-pays" aria-label="What it pays">
      {pays.map((pay) => (
        <li key={pay}>{pay.startsWith(":") ? <code>{pay}</code> : pay}</li>
      ))}
    </ul>
  );
}

function ThinBar({ count, goal }: { count: number; goal: number }) {
  return (
    <span className="proto-bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={count} aria-label={`${count} of ${goal}`}>
      <span className="proto-bar-fill" style={{ width: `${Math.max(4, (count / goal) * 100)}%` }} />
    </span>
  );
}

const hoverGrace = 150;

function useSwirl() {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const spot = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const leaving = useRef<number | undefined>(undefined);
  useOutside(pinned, [spot, card], () => setPinned(false));
  const hover = {
    onMouseEnter: () => {
      window.clearTimeout(leaving.current);
      setHovered(true);
    },
    onMouseLeave: () => {
      leaving.current = window.setTimeout(() => setHovered(false), hoverGrace);
    },
  };
  return { spot, card, open: pinned || hovered, toggle: () => setPinned((was) => !was), hover };
}

function useOutside(on: boolean, inside: React.RefObject<HTMLElement | null>[], close: () => void) {
  useEffect(() => {
    if (!on) return;
    const away = (event: MouseEvent) => {
      if (!inside.some((element) => element.current?.contains(event.target as Node))) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [on, inside, close]);
}

type Placement = { top: number; left: number; side: "above" | "below" };

const gap = 8;

function viewportRoom() {
  const top = (document.querySelector(".al-top")?.getBoundingClientRect().bottom ?? 0) + gap;
  const switcher = document.querySelector(".proto-switch")?.getBoundingClientRect().top ?? window.innerHeight;
  return { top, bottom: Math.min(window.innerHeight, switcher) - gap };
}

function placementOf(anchor: DOMRect, card: HTMLElement): Placement {
  const room = viewportRoom();
  const height = card.offsetHeight;
  const width = card.offsetWidth;
  const spaceBelow = room.bottom - anchor.bottom - gap;
  const spaceAbove = anchor.top - gap - room.top;
  const side = height <= spaceBelow || spaceBelow >= spaceAbove ? "below" : "above";
  const wanted = side === "below" ? anchor.bottom + gap : anchor.top - gap - height;
  const top = Math.max(room.top, Math.min(wanted, room.bottom - height));
  const left = Math.max(gap, Math.min(anchor.left + anchor.width / 2 - width / 2, window.innerWidth - width - gap));
  return { top, left, side };
}

function Floating({ anchor, card, hover, children }: { anchor: HTMLElement | null; card: React.RefObject<HTMLDivElement | null>; hover?: { onMouseEnter: () => void; onMouseLeave: () => void }; children: ReactNode }) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      if (anchor === null || card.current === null) return;
      setPlacement(placementOf(anchor.getBoundingClientRect(), card.current));
    };
    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [anchor, card]);
  const host = document.querySelector(".al-shell") ?? document.body;
  return createPortal(
    <div ref={card} className="proto-floating" data-side={placement?.side} style={{ top: placement?.top ?? 0, left: placement?.left ?? 0, visibility: placement === null ? "hidden" : undefined }} {...hover}>
      {children}
    </div>,
    host,
  );
}

function MilestoneStrip({ steps }: { steps: Step[] }) {
  return (
    <section className="proto-strip-section" aria-label="Next milestones">
      <p className="al-eyebrow">Next milestones</p>
      <ol className="proto-strip">
        {steps.map((step) => (
          <StripTile key={step.key} step={step} />
        ))}
      </ol>
    </section>
  );
}

function StripTile({ step }: { step: Step }) {
  const swirl = useSwirl();
  return (
    <li>
      <div ref={swirl.spot} className="proto-strip-spot" {...swirl.hover}>
        <button type="button" className="proto-strip-tile" aria-expanded={swirl.open} onClick={swirl.toggle}>
          {step.art}
          <span className="proto-strip-name">{step.name}</span>
          <span className="proto-strip-to-go">{step.goal - step.count} to go</span>
          <ThinBar count={step.count} goal={step.goal} />
        </button>
        {swirl.open && (
          <Floating anchor={swirl.spot.current} card={swirl.card} hover={swirl.hover}>
          <div className="proto-swirl" role="dialog" aria-label={`${step.name}: how to get it`}>
            <p className="proto-swirl-metal">
              {step.metal !== null && <Medal tier={step.metal} earned={false} size={16} />} {step.kind}
            </p>
            <p className="proto-swirl-title">{step.name}</p>
            <p className="proto-swirl-label">How to get it</p>
            <p>{step.takes}.</p>
            <p className="proto-swirl-label">What it pays</p>
            <Pays pays={step.pays} />
            <SlackLink chatUrl={slack} variant="primary">
              {step.action} in Slack
            </SlackLink>
          </div>
          </Floating>
        )}
      </div>
    </li>
  );
}

function UpNextList({ steps }: { steps: Step[] }) {
  return (
    <section className="proto-upnext" aria-label="Up next">
      <div className="proto-upnext-head">
        <p className="al-eyebrow">Up next</p>
        <SlackLink chatUrl={slack} variant="primary">
          Give a kudos in Slack
        </SlackLink>
      </div>
      <ol className="proto-upnext-list">
        {steps.map((step, index) => (
          <li key={step.key} className="proto-upnext-row">
            <span className="proto-upnext-number">{index + 1}</span>
            {step.art}
            <span className="proto-upnext-words">
              <strong>{step.name}</strong> <span className="al-quiet">· {step.kind}</span>
              <span className="proto-upnext-takes">{step.takes}</span>
            </span>
            <span className="proto-upnext-progress">
              <span>
                {step.count} of {step.goal}
              </span>
              <ThinBar count={step.count} goal={step.goal} />
            </span>
            <span className="proto-upnext-pays">{step.pays.join(" · ")}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Road({ steps }: { steps: Step[] }) {
  const [chosen, setChosen] = useState(steps[0]?.key ?? "");
  const shown = steps.find(({ key }) => key === chosen) ?? steps[0];
  return (
    <section className="proto-road-section" aria-label="What's next">
      <p className="al-eyebrow">Your next five</p>
      <ol className="proto-road">
        {steps.map((step, index) => (
          <li key={step.key} className="proto-road-stop" data-chosen={step.key === shown?.key ? "" : undefined}>
            <button type="button" onClick={() => setChosen(step.key)} aria-pressed={step.key === shown?.key}>
              <span className="proto-road-art">{step.art}</span>
              <span className="proto-road-name">{step.name}</span>
              <span className="proto-road-kind">{index === 0 ? "Closest" : step.kind}</span>
              <span className="proto-road-to-go">{step.goal - step.count} to go</span>
            </button>
          </li>
        ))}
      </ol>
      {shown !== undefined && (
        <div className="proto-road-detail" key={shown.key}>
          <div>
            <p className="proto-swirl-label">How to get {shown.name}</p>
            <p>{shown.takes}.</p>
          </div>
          <div>
            <p className="proto-swirl-label">What it pays</p>
            <Pays pays={shown.pays} />
          </div>
          <SlackLink chatUrl={slack} variant="primary">
            {shown.action} in Slack
          </SlackLink>
        </div>
      )}
    </section>
  );
}

export function LockedTeamPrototype({ album, team }: { album: Album; team: AlbumTeam }) {
  const variant = useBookVariant();
  const people = team.people.map((person) => personIn(album, person));
  const missing = people.filter(({ held }) => !held);
  return (
    <article className="al-page-body al-team-page" data-proto={variant}>
      <header>
        <p className="al-eyebrow">{team.mine ? "Your team" : "Team page"}</p>
        <PageTitle tab={team.name} size="hero">
          {team.name}
        </PageTitle>
        <p className="al-lede">{plural(people.length + team.unmatched.length, "person", "people")}</p>
        <ShareLink album={album} page={{ kind: "team", team: team.team }} cardOf={`the ${team.name}`} />
      </header>
      {variant === "A" && <SwirlTeam team={team} people={people} missing={missing} />}
      {variant === "B" && <ChecklistTeam team={team} people={people} missing={missing} />}
      {variant === "C" && <FlipTeam team={team} people={people} missing={missing} />}
    </article>
  );
}

type TeamProps = { team: AlbumTeam; people: AlbumPerson[]; missing: AlbumPerson[] };

function teamPays(team: AlbumTeam) {
  return ["a rare hoggie", `:team-${team.team}:`, xpPlaceholder];
}

function TeamProgress({ team, onClick, expanded }: { team: AlbumTeam; onClick?: (event: React.MouseEvent<HTMLElement>) => void; expanded?: boolean }) {
  const words = `${team.held} of ${team.total} collected · ${team.total - team.held} to go`;
  const body = (
    <>
      <span className="proto-team-progress-words">
        <strong>Unlock the {team.name} sticker</strong>
        <span className="al-quiet">{words}</span>
      </span>
      <span className="proto-team-progress-track">
        <span className="proto-bar-fill" style={{ width: `${Math.max(4, progressOf(team) * 100)}%` }} />
      </span>
    </>
  );
  if (onClick === undefined) return <div className="proto-team-progress">{body}</div>;
  return (
    <button type="button" className="proto-team-progress" aria-expanded={expanded} onClick={onClick}>
      {body}
      <span className="proto-team-progress-chevron" aria-hidden="true">
        {expanded ? "▴" : "▾"}
      </span>
    </button>
  );
}

function GiveRow({ person }: { person: AlbumPerson }) {
  return (
    <li className="proto-give-row">
      <PersonPicture face={person.face} name={person.name} collected={false} frame="proto-give-face" className="al-photo-face" />
      <span className="proto-give-name ph-no-capture">{person.name}</span>
      <SlackLink chatUrl={slack} variant="outline">
        Give {firstNameOf(person.name)} a kudos
      </SlackLink>
    </li>
  );
}

function UnlockCard({ team, missing, focus, onClose }: { team: AlbumTeam; missing: AlbumPerson[]; focus: AlbumPerson | null; onClose?: () => void }) {
  const listed = focus === null ? missing : [focus];
  return (
    <div className="proto-swirl proto-swirl-team" role="dialog" aria-label={`How to unlock the ${team.name} sticker`}>
      {onClose !== undefined && (
        <button type="button" className="proto-swirl-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      )}
      <p className="proto-swirl-title">{focus === null ? `Unlock the ${team.name} sticker` : `${firstNameOf(focus.name)} isn't in your album yet`}</p>
      <p className="proto-swirl-label">How to get it</p>
      <p>{focus === null ? `Give a kudos to every member. ${plural(missing.length, "person", "people")} left:` : `Give ${firstNameOf(focus.name)} a kudos: their sticker joins your album, and the team is ${team.total - team.held - 1 === 0 ? "complete" : `${team.total - team.held - 1} more from complete`}.`}</p>
      <ul className="proto-give">
        {listed.map((person) => (
          <GiveRow key={person.person} person={person} />
        ))}
      </ul>
      <p className="proto-swirl-label">What the sticker pays</p>
      <Pays pays={teamPays(team)} />
    </div>
  );
}

type Opened = { focus: AlbumPerson | null; anchor: HTMLElement };

function SwirlTeam({ team, people, missing }: TeamProps) {
  const [open, setOpen] = useState<Opened | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(null), []);
  useOutside(open !== null, [card], close);
  const openFrom = (focus: AlbumPerson | null) => (event: React.MouseEvent<HTMLElement>) => {
    const anchor = event.currentTarget;
    setOpen((was) => (was?.anchor === anchor ? null : { focus, anchor }));
  };
  return (
    <>
      <TeamProgress team={team} onClick={openFrom(null)} expanded={open !== null} />
      <figure className="al-team-photo" aria-label={`${team.name} team photo`}>
        <ul className="al-photo" data-size={people.length > 5 ? "many" : "few"}>
          {people.map((person) => (
            <li key={person.person} className="al-photo-person" data-out={person.held ? undefined : ""}>
              {person.held ? (
                <AppLink href={hrefOf({ kind: "person", person: person.person })} className="al-photo-link">
                  <PersonPicture face={person.face} name={person.name} collected frame="al-photo-sticker" className="al-photo-face" />
                  <span className="al-photo-name ph-no-capture">{person.name}</span>
                </AppLink>
              ) : (
                <button type="button" className="al-photo-link proto-locked" onClick={openFrom(person)} aria-label={`${person.name}, not in your album yet: how to get them`}>
                  <PersonPicture face={person.face} name={person.name} collected={false} frame="al-photo-sticker" className="al-photo-face" />
                  <span className="al-photo-name ph-no-capture">{person.name}</span>
                  <span className="proto-locked-hint">How to get</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="al-seal-spot">
          <button type="button" className="al-seal proto-seal-button" data-state="progress" aria-label={`${team.name} sticker, ${team.held} of ${team.total}: how to unlock it`} onClick={openFrom(null)}>
            <SealArt team={team} coloured={false} size={128} />
            <span className="proto-seal-lock" aria-hidden="true">
              ?
            </span>
          </button>
        </div>
      </figure>
      {open !== null && (
        <Floating key={open.anchor.className + (open.focus?.person ?? "")} anchor={open.anchor} card={card}>
          <UnlockCard team={team} missing={missing} focus={open.focus} onClose={close} />
        </Floating>
      )}
    </>
  );
}

function ChecklistTeam({ team, people, missing }: TeamProps) {
  const [open, setOpen] = useState(false);
  const [lit, setLit] = useState<string | null>(null);
  const openFor = (person: string | null) => {
    setOpen(true);
    setLit(person);
  };
  return (
    <>
      <figure className="al-team-photo" aria-label={`${team.name} team photo`}>
        <ul className="al-photo" data-size={people.length > 5 ? "many" : "few"}>
          {people.map((person) => (
            <li key={person.person} className="al-photo-person" data-out={person.held ? undefined : ""}>
              {person.held ? (
                <AppLink href={hrefOf({ kind: "person", person: person.person })} className="al-photo-link">
                  <PersonPicture face={person.face} name={person.name} collected frame="al-photo-sticker" className="al-photo-face" />
                  <span className="al-photo-name ph-no-capture">{person.name}</span>
                </AppLink>
              ) : (
                <button type="button" className="al-photo-link proto-locked" onClick={() => openFor(person.person)} aria-label={`${person.name}, not in your album yet`}>
                  <PersonPicture face={person.face} name={person.name} collected={false} frame="al-photo-sticker" className="al-photo-face" />
                  <span className="proto-plus" aria-hidden="true">
                    +
                  </span>
                  <span className="al-photo-name ph-no-capture">{person.name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="al-seal-spot">
          <button type="button" className="al-seal proto-seal-button" data-state="progress" aria-label={`${team.name} sticker, ${team.held} of ${team.total}`} onClick={() => openFor(null)}>
            <SealArt team={team} coloured={false} size={128} />
          </button>
        </div>
      </figure>
      <section className="proto-checklist" data-open={open ? "" : undefined}>
        <TeamProgress team={team} onClick={() => setOpen(!open)} expanded={open} />
        {open && (
          <div className="proto-checklist-body">
            <ol className="proto-checklist-rows">
              {people.map((person) => (
                <li key={person.person} className="proto-checklist-row" data-done={person.held ? "" : undefined} data-lit={lit === person.person ? "" : undefined}>
                  <span className="proto-check" aria-hidden="true">
                    {person.held ? "✓" : ""}
                  </span>
                  <span className="ph-no-capture">{person.name}</span>
                  {person.held ? (
                    <span className="al-quiet">In your album</span>
                  ) : (
                    <SlackLink chatUrl={slack} variant="outline">
                      Give {firstNameOf(person.name)} a kudos
                    </SlackLink>
                  )}
                </li>
              ))}
            </ol>
            <div className="proto-checklist-pays">
              <p className="proto-swirl-label">When everyone is in, the sticker pays</p>
              <Pays pays={teamPays(team)} />
              <p className="al-quiet proto-small">{missing.length === 1 ? "One kudos away." : `${missing.length} kudos away.`}</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function FlipTeam({ team, people, missing }: TeamProps) {
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const flip = (key: string) =>
    setFlipped((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <>
      <div className="proto-segments" role="img" aria-label={`${team.held} of ${team.total} collected`}>
        {people.map((person) => (
          <span key={person.person} className="proto-segment" data-held={person.held ? "" : undefined} title={person.name} />
        ))}
        <span className="proto-segments-words">
          {team.held} of {team.total} · {plural(missing.length, "kudos", "kudos")} to the sticker
        </span>
      </div>
      <figure className="al-team-photo" aria-label={`${team.name} team photo`}>
        <ul className="al-photo" data-size={people.length > 5 ? "many" : "few"}>
          {people.map((person) => (
            <li key={person.person} className="al-photo-person" data-out={person.held ? undefined : ""}>
              {person.held ? (
                <AppLink href={hrefOf({ kind: "person", person: person.person })} className="al-photo-link">
                  <PersonPicture face={person.face} name={person.name} collected frame="al-photo-sticker" className="al-photo-face" />
                  <span className="al-photo-name ph-no-capture">{person.name}</span>
                </AppLink>
              ) : (
                <div className="proto-flip" data-flipped={flipped.has(person.person) ? "" : undefined}>
                  <button type="button" className="proto-flip-front al-photo-link" onClick={() => flip(person.person)} aria-label={`${person.name}, not in your album yet`}>
                    <PersonPicture face={person.face} name={person.name} collected={false} frame="al-photo-sticker" className="al-photo-face" />
                    <span className="al-photo-name ph-no-capture">{person.name}</span>
                  </button>
                  <div className="proto-flip-back" aria-hidden={!flipped.has(person.person)}>
                    <span>Not in your album yet</span>
                    <SlackLink chatUrl={slack} variant="primary">
                      Give {firstNameOf(person.name)} a kudos
                    </SlackLink>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="al-seal-spot proto-seal-flip-spot">
          <div className="proto-flip proto-flip-seal" data-flipped={flipped.has("seal") ? "" : undefined}>
            <button type="button" className="proto-flip-front al-seal" data-state="progress" onClick={() => flip("seal")} aria-label={`${team.name} sticker: how to unlock it`}>
              <SealArt team={team} coloured={false} size={128} />
            </button>
            <button type="button" className="proto-flip-back proto-seal-back" onClick={() => flip("seal")} aria-hidden={!flipped.has("seal")}>
              <strong>{plural(missing.length, "kudos", "kudos")} to go</strong>
              <span>A kudos to every member unlocks it.</span>
              <span className="proto-seal-back-pays">Pays a rare hoggie · :team-{team.team}: · {xpPlaceholder}</span>
            </button>
          </div>
        </div>
      </figure>
    </>
  );
}

function useEscape(on: boolean, close: () => void) {
  useEffect(() => {
    if (!on) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [on, close]);
}

export function BookPrototypeBar() {
  const variant = useBookVariant();
  const step = useCallback(
    (by: number) => {
      const at = bookVariants.findIndex(({ key }) => key === variant);
      chooseBookVariant(bookVariants[(at + by + bookVariants.length) % bookVariants.length]!.key);
    },
    [variant],
  );
  useArrowKeys(step);
  if (variant === null) return null;
  const current = bookVariants.find(({ key }) => key === variant)!;
  return (
    <div className="proto-switch" role="toolbar" aria-label="Prototype switcher">
      <div className="proto-switch-row">
        <button type="button" className="proto-switch-arrow" aria-label="Previous variant" onClick={() => step(-1)}>
          ←
        </button>
        <span className="proto-switch-label">
          <strong>{current.key}</strong> {current.label}
        </span>
        <button type="button" className="proto-switch-arrow" aria-label="Next variant" onClick={() => step(1)}>
          →
        </button>
      </div>
      <p className="proto-switch-readout">
        Try: <a href={`/book?variant=${variant}`}>Book</a> · <a href={`/book?variant=${variant}#teams/paper-moons`}>a locked team</a> · the sidebar's teams and “Show more”
      </p>
    </div>
  );
}

function useArrowKeys(step: (by: number) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key === "ArrowLeft") step(-1);
      if (event.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);
}

