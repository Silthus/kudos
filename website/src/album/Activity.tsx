import { useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { hoggieNamed } from "../../../convex/album/hoggies/catalogue";
import { KudosMessage } from "../activity/KudosMessage";
import { AnswerPage } from "../pages/AnswerPage";
import { AppLink } from "../AppLink";
import { hoggiePictureOf } from "../crates/Hoggie";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import type { Message } from "../shell";
import { LoadingPage } from "../pages/LoadingPage";
import { SlackLink } from "../SlackLink";
import type { AlbumWeek, HoggiesFound, KudosOfTheWeek, PeopleListed, WeekIssue, WeekKudos, WeekKudosList, WeekPerson, WeekTab } from "./answer";
import { plural } from "./facts";
import { rarityWordOf } from "./opening";
import { hrefOf } from "./place";
import type { WeekEdition } from "./weekEdition";

type ActivityAnswerProps = { edition: WeekEdition; me: string; onSignIn: () => void; onSignOut: () => void };

export function ActivityAnswerPage({ edition, me, ...answers }: ActivityAnswerProps) {
  const { shown } = edition;
  if (shown === undefined || shown.kind === "off") return <LoadingPage shape="column" />;
  if (shown.kind !== "week") return <AnswerPage answer={shown} {...answers} />;
  return <WeeklyEditionPage answer={shown} edition={edition} me={me} />;
}

function WeeklyEditionPage({ answer, edition, me }: { answer: AlbumWeek; edition: WeekEdition; me: string }) {
  const ids = useId();
  const firstIssue = answer.weeks.length === 0;
  return (
    <div className="al-page-body al-activity">
      <p className="al-eyebrow">Activity</p>
      <PageTitle tab="Activity" size="hero">
        Weekly edition
      </PageTitle>
      <p className="al-lede">{firstIssue ? "Your first issue comes out the week you first thank someone or get thanked." : "Each week of your album in one issue. Pick a week to read it."}</p>
      {!firstIssue && (
        <>
          <WeekTabs weeks={answer.weeks} chosen={edition.chosen ?? answer.week} thisWeek={edition.thisWeek} ids={ids} onChoose={edition.choose} />
          <IssuePanel answer={answer} labelledBy={answer.weeks.some(({ week }) => week === answer.week) ? tabIdOf(ids, answer.week) : `${ids}-issue`} ids={ids} thisWeek={edition.thisWeek} loading={edition.loading} me={me} />
        </>
      )}
    </div>
  );
}

function tabIdOf(ids: string, week: string) {
  return `${ids}-week-${week}`;
}

type WeekTabsProps = { weeks: WeekTab[]; chosen: string; thisWeek: string | undefined; ids: string; onChoose: (week: string) => void };

function WeekTabs({ weeks, chosen, thisWeek, ids, onChoose }: WeekTabsProps) {
  const tabs = useRef(new Map<string, HTMLButtonElement>());
  const busiest = Math.max(1, ...weeks.flatMap(({ days }) => days));
  const tabbable = weeks.some(({ week }) => week === chosen) ? chosen : weeks[0]!.week;
  const choose = (week: string) => {
    onChoose(week);
    tabs.current.get(week)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = weekAfterKey(weeks, tabbable, event.key);
    if (next === undefined) return;
    event.preventDefault();
    choose(next);
  };
  return (
    <div role="tablist" aria-label="Weeks" className="al-week-tabs" onKeyDown={onKeyDown}>
      {weeks.map((tab) => (
        <button
          key={tab.week}
          ref={(button) => keepTab(tabs.current, tab.week, button)}
          type="button"
          role="tab"
          id={tabIdOf(ids, tab.week)}
          aria-selected={tab.week === chosen}
          aria-controls={`${ids}-panel`}
          tabIndex={tab.week === tabbable ? 0 : -1}
          className="al-week-tab"
          onClick={() => choose(tab.week)}
        >
          <span className="al-week-tab-label">{tabLabelOf(tab.week, thisWeek)}</span>
          <span className="al-week-tab-span">{weekSpanOf(tab.week)}</span>
          <Sparkline days={tab.days} busiest={busiest} />
          <span className="al-week-tab-count">{momentsOf(tab)}</span>
        </button>
      ))}
    </div>
  );
}

function keepTab(tabs: Map<string, HTMLButtonElement>, week: string, button: HTMLButtonElement | null) {
  if (button === null) tabs.delete(week);
  else tabs.set(week, button);
}

function weekAfterKey(weeks: WeekTab[], from: string, key: string): string | undefined {
  const at = weeks.findIndex(({ week }) => week === from);
  switch (key) {
    case "ArrowRight":
      return weeks[Math.min(at + 1, weeks.length - 1)]?.week;
    case "ArrowLeft":
      return weeks[Math.max(at - 1, 0)]?.week;
    case "Home":
      return weeks[0]?.week;
    case "End":
      return weeks.at(-1)?.week;
  }
}

function Sparkline({ days, busiest }: { days: number[]; busiest: number }) {
  return (
    <span className="al-week-bars" aria-hidden="true">
      {days.map((count, day) => (
        <span key={day} data-day={day} data-empty={count === 0 ? "" : undefined} style={{ "--al-day": String(Math.round((count / busiest) * 1000) / 1000) } as CSSProperties} />
      ))}
    </span>
  );
}

function momentsOf({ days, counted }: WeekTab) {
  const moments = days.reduce((sum, count) => sum + count, 0) || counted;
  if (moments === 0) return "A quiet week";
  return moments === 1 ? "1 kudos or hug" : `${moments} kudos and hugs`;
}

type IssuePanelProps = { answer: AlbumWeek; labelledBy: string; ids: string; thisWeek: string | undefined; loading: boolean; me: string };

function IssuePanel({ answer: { week, issue }, labelledBy, ids, thisWeek, loading, me }: IssuePanelProps) {
  return (
    <section role="tabpanel" id={`${ids}-panel`} tabIndex={0} aria-labelledby={labelledBy} aria-busy={loading || undefined} className="al-issue">
      <header className="al-issue-head">
        <p className="al-eyebrow">{weekSpanOf(week)}</p>
        <h2 id={`${ids}-issue`} className="al-issue-title">
          {headlineOf(week, thisWeek)}
        </h2>
      </header>
      {issue === null ? <p className="al-issue-quiet">No issue for this week.</p> : <Issue issue={issue} me={me} />}
    </section>
  );
}

function Issue({ issue, me }: { issue: WeekIssue; me: string }) {
  return (
    <>
      <Tallies issue={issue} />
      {isQuiet(issue) ? <p className="al-issue-quiet">A quiet week. Give someone a kudos in Slack, and it shows here.</p> : <IssueBody issue={issue} me={me} />}
    </>
  );
}

function isQuiet(issue: WeekIssue) {
  const lists = [issue.thanked, issue.thankedBy, issue.hugged, issue.huggedBy, issue.newFaces];
  return issue.days.every((count) => count === 0) && !hasRecognitions(issue) && issue.packsOpened === 0 && issue.kudosOfWeek === null && lists.every((list) => countOf(list) === 0) && countOf(issue.hoggies) === 0 && issue.given.kudos.length + issue.received.kudos.length === 0;
}

function hasRecognitions({ kudosGiven, kudosReceived, hugsGiven, hugsReceived }: WeekIssue) {
  return kudosGiven + kudosReceived + hugsGiven + hugsReceived > 0;
}

function countOf({ more, ...list }: PeopleListed | HoggiesFound) {
  return ("people" in list ? list.people.length : list.hoggies.length) + more;
}

function Tallies({ issue }: { issue: WeekIssue }) {
  const thanked = countOf(issue.thanked);
  const thankedBy = countOf(issue.thankedBy);
  const newFaces = countOf(issue.newFaces);
  const hugs = issue.hugsGiven + issue.hugsReceived;
  return (
    <dl className="al-issue-tallies">
      <Tally term={thanked === 1 ? "person you thanked" : "people you thanked"} figure={thanked} note={`${issue.kudosGiven} kudos`} />
      <Tally term="thanked you" figure={thankedBy} note={`${issue.kudosReceived} kudos`} />
      <Tally term={issue.packsOpened === 1 ? "pack opened" : "packs opened"} figure={issue.packsOpened} note={newFaces === 0 ? "no new faces" : `${plural(newFaces, "new face", "new faces")} in your album`} />
      <Tally term={hugs === 1 ? "hug" : "hugs"} figure={hugs} note={`${issue.hugsGiven} given · ${issue.hugsReceived} received`} />
    </dl>
  );
}

function Tally({ term, figure, note }: { term: string; figure: number; note: string }) {
  return (
    <div className="al-issue-tally">
      <dt>{term}</dt>
      <dd className="al-issue-figure">{figure}</dd>
      <dd className="al-issue-note">{note}</dd>
    </div>
  );
}

function IssueBody({ issue, me }: { issue: WeekIssue; me: string }) {
  const ledByYou = issue.kudosOfWeek?.giver.person === me;
  return (
    <div className="al-issue-body">
      <div className="al-issue-main">
        {issue.kudosOfWeek !== null && <KudosOfTheWeekStory kudos={issue.kudosOfWeek} me={me} />}
        <KudosSection title={ledByYou ? "Everyone else you thanked" : "Who you thanked"} list={issue.given} />
        <KudosSection title="Said to you" list={issue.received} />
      </div>
      <div className="al-issue-side">
        <Section title="New in your album">{countOf(issue.newFaces) === 0 ? <p className="al-issue-hint">No new faces this week. A kudos to someone new brings their card.</p> : <People listed={issue.newFaces} />}</Section>
        {countOf(issue.hoggies) > 0 && (
          <Section title="Hoggies from your packs">
            <Hoggies found={issue.hoggies} />
          </Section>
        )}
        <QuietHugs hugged={issue.hugged} huggedBy={issue.huggedBy} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} className="al-issue-section">
      <h3 id={heading} className="al-issue-section-title">
        {title}
      </h3>
      {children}
    </section>
  );
}

function KudosOfTheWeekStory({ kudos, me }: { kudos: KudosOfTheWeek; me: string }) {
  const fromYou = kudos.giver.person === me;
  return (
    <Section title="The kudos of the week">
      <blockquote className="al-issue-quote">
        <KudosMessage message={kudos.message} />
      </blockquote>
      <div className="al-issue-byline">
        <MemberFace face={kudos.giver.face} className="al-issue-byline-face" />
        <div className="al-issue-byline-words">
          {fromYou ? <p>From you</p> : <p className="ph-no-capture">From {kudos.giver.name}</p>}
          <p className="al-issue-hint">{[kudos.hugs > 0 ? plural(kudos.hugs, "hug", "hugs") : null, weekdayOf(kudos.at)].filter((part) => part !== null).join(" · ")}</p>
        </div>
        {kudos.permalink !== null && (
          <SlackLink chatUrl={kudos.permalink} variant="outline">
            Open in Slack
          </SlackLink>
        )}
      </div>
    </Section>
  );
}

function KudosSection({ title, list: { kudos, more } }: { title: string; list: WeekKudosList }) {
  if (kudos.length === 0 && !more) return null;
  return (
    <Section title={title}>
      {kudos.length > 0 && (
        <ul className="al-issue-said">
          {kudos.map((each, index) => (
            <SaidLine key={`${each.at}-${index}`} kudos={each} />
          ))}
        </ul>
      )}
      {more && <p className="al-issue-hint">More kudos came this week than an issue lists.</p>}
    </Section>
  );
}

function SaidLine({ kudos: { people, morePeople, message, at } }: { kudos: WeekKudos }) {
  const [first] = people;
  return (
    <li className="al-issue-said-line">
      {first === undefined ? <span /> : <MemberFace face={first.face} className="al-issue-said-face" />}
      <div className="al-issue-said-body">
        <p className="al-issue-said-who">
          <Names people={people} more={morePeople} /> <span className="al-issue-hint">· {shortWeekdayOf(at)}</span>
        </p>
        <blockquote className="al-issue-said-words" data-quoted={isQuotable(message) || undefined}>
          <KudosMessage message={message} />
        </blockquote>
      </div>
    </li>
  );
}

function isQuotable(message: Message) {
  return message.kind === "text" && !message.edited;
}

function Names({ people, more }: { people: WeekPerson[]; more: number }) {
  const names = people.map(({ person, name }) => (
    <AppLink key={person} href={hrefOf({ kind: "person", person })} className="al-issue-said-name ph-no-capture">
      {name}
    </AppLink>
  ));
  return <>{joinedWithAnd(more > 0 ? [...names, <span key="more">{more} more</span>] : names)}</>;
}

function joinedWithAnd(parts: ReactNode[]): ReactNode[] {
  return parts.flatMap((part, index) => (index === 0 ? [part] : [index === parts.length - 1 ? " and " : ", ", part]));
}

function People({ listed: { people, more } }: { listed: PeopleListed }) {
  return (
    <>
      <ul className="al-issue-people">
        {people.map(({ person, name, face }) => (
          <li key={person}>
            <AppLink href={hrefOf({ kind: "person", person })} className="al-issue-person">
              <MemberFace face={face} className="al-issue-face" />
              <span className="ph-no-capture">{name}</span>
            </AppLink>
          </li>
        ))}
      </ul>
      <More count={more} />
    </>
  );
}

function More({ count }: { count: number }) {
  return count > 0 ? <p className="al-issue-hint">and {count} more</p> : null;
}

function Hoggies({ found: { hoggies, more } }: { found: HoggiesFound }) {
  return (
    <>
      <ul className="al-issue-hoggies">
        {hoggies.map(({ hoggie, rarity }, index) => (
          <li key={`${hoggie}-${index}`}>
            <AppLink href={hrefOf({ kind: "hoggies", hoggie })} className="al-issue-hoggie" style={{ "--al-rarity": `var(--rarity-${rarity})` } as CSSProperties}>
              <HoggieArt hoggie={hoggie} />
              <span className="al-issue-hoggie-name">{hoggieNamed(hoggie)?.name ?? hoggie}</span>
              <span className="al-issue-hoggie-rarity">{rarityWordOf(rarity)}</span>
            </AppLink>
          </li>
        ))}
      </ul>
      <More count={more} />
    </>
  );
}

function HoggieArt({ hoggie }: { hoggie: string }) {
  const picture = hoggiePictureOf({ kind: "hoggie", slug: hoggie });
  return <span className="al-issue-hoggie-art">{picture !== undefined && <img src={picture} alt="" draggable={false} />}</span>;
}

function QuietHugs({ hugged, huggedBy }: { hugged: PeopleListed; huggedBy: PeopleListed }) {
  const gave = countOf(hugged);
  const got = countOf(huggedBy);
  if (gave + got === 0) return null;
  return (
    <Section title="Quiet hugs">
      {gave > 0 && (
        <>
          <p className="al-issue-hug-line">You hugged {plural(gave, "person", "people")}</p>
          <People listed={hugged} />
        </>
      )}
      {got > 0 && (
        <>
          <p className="al-issue-hug-line">{got === 1 ? "1 person hugged you" : `${got} people hugged you`}</p>
          <People listed={huggedBy} />
        </>
      )}
    </Section>
  );
}

const day = 24 * 60 * 60 * 1000;

const dayAndMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" });

const shortWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

function mondayOf(week: string) {
  return Date.parse(`${week}T00:00:00Z`);
}

function weekBefore(week: string) {
  return new Date(mondayOf(week) - 7 * day).toISOString().slice(0, 10);
}

function weekSpanOf(week: string) {
  const [monday, sunday] = [new Date(mondayOf(week)), new Date(mondayOf(week) + 6 * day)];
  if (monday.getUTCMonth() === sunday.getUTCMonth()) return `${monday.getUTCDate()}–${sunday.getUTCDate()} ${month.format(sunday)}`;
  return `${dayAndMonth.format(monday)} – ${dayAndMonth.format(sunday)}`;
}

function tabLabelOf(week: string, thisWeek: string | undefined) {
  if (week === thisWeek) return "This week";
  if (thisWeek !== undefined && week === weekBefore(thisWeek)) return "Last week";
  return `Week of ${dayAndMonth.format(mondayOf(week))}`;
}

function headlineOf(week: string, thisWeek: string | undefined) {
  if (week === thisWeek) return "This week in your album";
  if (thisWeek !== undefined && week === weekBefore(thisWeek)) return "Last week in your album";
  return `Your album, ${weekSpanOf(week)}`;
}

function weekdayOf(at: number) {
  return weekday.format(at);
}

function shortWeekdayOf(at: number) {
  return shortWeekday.format(at);
}
