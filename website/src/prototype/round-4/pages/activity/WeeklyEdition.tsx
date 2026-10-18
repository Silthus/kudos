// PROTOTYPE (#625, round 4): layout B of the activity page, a weekly edition: each week is one issue that sums up your album, with the kudos of the week as its lead story. Never merge to main.
import type { ReactNode } from "react";
import type { Album, Moment } from "../../../round-3/album";
import { useActivity } from "./history";
import { Face, HoggieFound, HugSentence, isHug, isOpening, isThanks, Name, PageHead, plural, Quote, TeamTag, type Hug, type Opening, type Thanks } from "./parts";
import { daysOfWeek, dayLabelOf, shortWeekdayOf, startOfDay, startOfWeek, today, weekLabelOf, weekSpanOf, weeksBefore } from "./time";
import { useHashParam } from "./useHashParam";
import "./activity.css";

const issues = ["0", "1", "2", "3"] as const;

type Issue = (typeof issues)[number];

type Edition = { weekStart: number; moments: Moment[]; given: Thanks[]; received: Thanks[]; openings: Opening[]; hugs: Hug[] };

function editionOf(moments: Moment[], weekStart: number): Edition {
  const inWeek = moments.filter(({ at }) => startOfWeek(at) === weekStart);
  const thanks = inWeek.filter(isThanks);
  return {
    weekStart,
    moments: inWeek,
    given: thanks.filter(({ kind }) => kind === "thoughtful-given"),
    received: thanks.filter(({ kind }) => kind === "thoughtful-received"),
    openings: inWeek.filter(isOpening),
    hugs: inWeek.filter(isHug),
  };
}

function headlineOf(edition: Edition) {
  if (edition.weekStart === startOfWeek(today())) return "This week in your album";
  if (edition.weekStart === weeksBefore(startOfWeek(today()), 1)) return "Last week in your album";
  return `Your album, ${weekSpanOf(edition.weekStart)}`;
}

export function WeeklyEdition() {
  const { album, moments } = useActivity();
  const [issue, chooseIssue] = useHashParam("week", issues, "0");
  const editions = issues.map((back) => editionOf(moments, weeksBefore(startOfWeek(today()), Number(back))));
  const edition = editions[Number(issue)]!;
  return (
    <div className="r4-act r4-act-edition">
      <PageHead title="Weekly edition" lede="Each week of your album in one issue. Pick a week to read it." />
      <nav className="r4-act-issues" aria-label="Weeks">
        {editions.map((each, index) => (
          <IssueTab key={each.weekStart} edition={each} chosen={index === Number(issue)} onChoose={() => chooseIssue(issues[index]!)} />
        ))}
      </nav>
      <article className="r4-act-issue" aria-labelledby="r4-act-issue-title">
        <header className="r4-act-issue-head">
          <p className="r4-act-eyebrow">{weekSpanOf(edition.weekStart)}</p>
          <h2 id="r4-act-issue-title" className="r4-act-issue-title">
            {headlineOf(edition)}
          </h2>
        </header>
        <Tally edition={edition} />
        {edition.moments.length === 0 ? <p className="r4-act-empty">A quiet week.</p> : <IssueBody album={album} edition={edition} />}
        <IssueFooter issue={Number(issue)} onChoose={(index) => chooseIssue(issues[index]!)} />
      </article>
    </div>
  );
}

function IssueTab({ edition, chosen, onChoose }: { edition: Edition; chosen: boolean; onChoose: () => void }) {
  const perDay = daysOfWeek(edition.weekStart).map((dayStart) => edition.moments.filter(({ at }) => startOfDay(at) === dayStart).length);
  const busiest = Math.max(1, ...perDay);
  return (
    <button type="button" className="r4-act-issue-tab" aria-pressed={chosen} onClick={onChoose}>
      <span className="r4-act-issue-tab-label">{weekLabelOf(edition.weekStart)}</span>
      <span className="r4-act-issue-tab-span">{weekSpanOf(edition.weekStart)}</span>
      <span className="r4-act-bars" aria-hidden="true">
        {perDay.map((count, index) => (
          <span key={index} style={{ height: `${Math.max(8, (count / busiest) * 100)}%` }} className={count === 0 ? "r4-act-bar-empty" : ""} />
        ))}
      </span>
      <span className="r4-act-issue-tab-count">{plural(edition.given.length, "thank-you")} · {plural(edition.openings.length, "pack")}</span>
    </button>
  );
}

function Tally({ edition }: { edition: Edition }) {
  const people = new Set(edition.given.map(({ person }) => person)).size;
  const fresh = edition.openings.filter(({ newPerson }) => newPerson).length;
  const gave = edition.hugs.filter(({ kind }) => kind === "hug-given").length;
  return (
    <dl className="r4-act-tally">
      <TallyCard figure={people} label={people === 1 ? "person you thanked" : "people you thanked"} note={plural(edition.given.length, "thoughtful kudos", "thoughtful kudos")} />
      <TallyCard figure={edition.received.length} label="thanked you" note="said why in Slack" />
      <TallyCard figure={edition.openings.length} label={edition.openings.length === 1 ? "pack opened" : "packs opened"} note={fresh === 0 ? "no new faces" : `${plural(fresh, "new face")} in the album`} />
      <TallyCard figure={edition.hugs.length} label={edition.hugs.length === 1 ? "hug" : "hugs"} note={`${gave} given · ${edition.hugs.length - gave} received`} />
    </dl>
  );
}

function TallyCard({ figure, label, note }: { figure: number; label: string; note: string }) {
  return (
    <div className="r4-act-tally-card">
      <dt>{label}</dt>
      <dd className="r4-act-tally-figure">{figure}</dd>
      <dd className="r4-act-tally-note">{note}</dd>
    </div>
  );
}

function leadOf(edition: Edition) {
  return edition.given.find((thanks) => thanks.kind === "thoughtful-given" && thanks.packed) ?? edition.given[0] ?? edition.received[0];
}

function IssueBody({ album, edition }: { album: Album; edition: Edition }) {
  const lead = leadOf(edition);
  const rest = edition.given.filter((thanks) => thanks !== lead);
  const saidToYou = edition.received.filter((thanks) => thanks !== lead);
  return (
    <div className="r4-act-issue-body">
      <div className="r4-act-issue-main">
        {lead !== undefined && <LeadStory album={album} thanks={lead} />}
        {rest.length > 0 && (
          <Section title="Everyone else you thanked">
            <ul className="r4-act-said">
              {rest.map((thanks) => (
                <SaidLine key={`${thanks.at}-${thanks.person}`} album={album} thanks={thanks} />
              ))}
            </ul>
          </Section>
        )}
        {saidToYou.length > 0 && (
          <Section title="Said to you">
            <ul className="r4-act-said">
              {saidToYou.map((thanks) => (
                <SaidLine key={`${thanks.at}-${thanks.person}`} album={album} thanks={thanks} />
              ))}
            </ul>
          </Section>
        )}
      </div>
      <aside className="r4-act-issue-side">
        <NewFaces album={album} openings={edition.openings} />
        <HoggiesFound album={album} openings={edition.openings} />
        <QuietHugs album={album} hugs={edition.hugs} />
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="r4-act-section">
      <h3 className="r4-act-section-title">{title}</h3>
      {children}
    </section>
  );
}

function LeadStory({ album, thanks }: { album: Album; thanks: Thanks }) {
  const given = thanks.kind === "thoughtful-given";
  return (
    <section className="r4-act-lead">
      <p className="r4-act-lead-kicker">{given ? "The kudos of the week" : "The words of the week"}</p>
      <Quote message={thanks.message} tone={given ? "given" : "received"} big />
      <div className="r4-act-byline">
        <Face album={album} person={thanks.person} size="l" />
        <div>
          <p>
            {given ? (
              <>
                You to <Name album={album} person={thanks.person} />
              </>
            ) : (
              <>
                <Name album={album} person={thanks.person} /> to you
              </>
            )}
          </p>
          <p className="r4-act-byline-meta">
            <TeamTag album={album} person={thanks.person} />
            <span>· {dayLabelOf(thanks.at)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function SaidLine({ album, thanks }: { album: Album; thanks: Thanks }) {
  return (
    <li className="r4-act-said-line">
      <Face album={album} person={thanks.person} size="s" />
      <div>
        <p className="r4-act-said-who">
          <Name album={album} person={thanks.person} /> <span className="r4-act-quiet">· {shortWeekdayOf(thanks.at)}</span>
        </p>
        <p className="r4-act-said-words">“{thanks.message}”</p>
      </div>
    </li>
  );
}

function NewFaces({ album, openings }: { album: Album; openings: Opening[] }) {
  const fresh = openings.filter(({ newPerson }) => newPerson);
  return (
    <Section title="New in your album">
      {fresh.length === 0 ? (
        <p className="r4-act-quiet">No new faces this week. A thoughtful kudos to someone new earns their sticker.</p>
      ) : (
        <ul className="r4-act-new-faces">
          {fresh.map((opening) => (
            <li key={opening.person}>
              <Face album={album} person={opening.person} size="l" />
              <Name album={album} person={opening.person} first />
              <TeamTag album={album} person={opening.person} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function HoggiesFound({ album, openings }: { album: Album; openings: Opening[] }) {
  if (openings.length === 0) return null;
  return (
    <Section title="Hoggies from your packs">
      <ul className="r4-act-hoggie-shelf">
        {openings.map((opening) => (
          <li key={`${opening.at}-${opening.person}`}>
            <HoggieFound album={album} opening={opening} size={56} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function QuietHugs({ album, hugs }: { album: Album; hugs: Hug[] }) {
  if (hugs.length === 0) return null;
  const received = hugs.filter(({ kind }) => kind === "hug-received");
  const given = hugs.filter(({ kind }) => kind === "hug-given");
  return (
    <Section title="Quiet hugs">
      <ul className="r4-act-hug-list">
        {received.length > 0 && (
          <li>
            <HugSentence album={album} direction="received" hugs={received} span=" this week" />
          </li>
        )}
        {given.length > 0 && (
          <li>
            <HugSentence album={album} direction="given" hugs={given} span=" this week" />
          </li>
        )}
      </ul>
    </Section>
  );
}

function IssueFooter({ issue, onChoose }: { issue: number; onChoose: (issue: number) => void }) {
  return (
    <footer className="r4-act-issue-foot">
      {issue < issues.length - 1 ? (
        <button type="button" className="r4-act-link-button" onClick={() => onChoose(issue + 1)}>
          ← The week before
        </button>
      ) : (
        <span />
      )}
      {issue > 0 && (
        <button type="button" className="r4-act-link-button" onClick={() => onChoose(issue - 1)}>
          The week after →
        </button>
      )}
    </footer>
  );
}
