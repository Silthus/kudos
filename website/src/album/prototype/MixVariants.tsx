// PROTOTYPE (throwaway): the mix Michael asked for after A, B and C.
// D Card and feed: player card with the level ring, varied stats, one rarest find, then this week's activity.
// E Card beside feed: the same card as a side column, the week's activity as the main column.
// Both render your own page and a teammate's page from one MixPage model.
import type { CSSProperties } from "react";
import { IconArrowRight, IconCrown, IconHeart, IconPeople, IconRibbon, IconSparkles } from "@posthog/icons";
import { AppLink } from "../../AppLink";
import { LadderEmblem } from "../../book/LadderEmblem";
import { MemberFace } from "../../Face";
import { KudosMessage } from "../../activity/KudosMessage";
import { SlackLink } from "../../SlackLink";
import type { Album, WeekIssue, WeekKudos, WeekPerson } from "../answer";
import { EmojiPicture } from "../EmojiPicture";
import { levelShareOf, plural, xpToNextOf } from "../facts";
import { emblemOf } from "../milestones";
import { rarityWordOf } from "../opening";
import { PetHoggie } from "../PetHoggie";
import { hrefOf } from "../place";
import { ShareLink } from "../ShareLink";
import { dateOf, firstNameOf, howToCollectWords } from "../teamPage";
import type { MixPage } from "./mixPages";
import type { MixLayout } from "./personPagePrototype";
import { Bar, HoggieImage, LevelRing, rarityStyle, TeamLine, Title } from "./ProfileVariants";
import "./mixVariants.css";

type Props = { layout: MixLayout; page: MixPage; album: Album };

export function MixVariant({ layout, page, album }: Props) {
  return layout === "d" ? <CardAndFeed page={page} album={album} /> : <CardBesideFeed page={page} album={album} />;
}

function CardAndFeed({ page, album }: { page: MixPage; album: Album }) {
  return (
    <article className="pp-m pp-d">
      <section className="pp-m-card pp-d-card" aria-label={page.own ? "Your card" : `${page.name}'s card`}>
        <header className="pp-d-id">
          <Ring page={page} />
          <Who page={page} album={album} />
          <Share page={page} album={album} />
        </header>
        <RankStrip page={page} />
        <VariedStats page={page} />
      </section>
      <RarestFind page={page} />
      {page.together !== null && <Together page={page} />}
      <Feed page={page} lines={2} />
    </article>
  );
}

function CardBesideFeed({ page, album }: { page: MixPage; album: Album }) {
  return (
    <article className="pp-m pp-e">
      <aside className="pp-e-side">
        <section className="pp-m-card pp-e-card" aria-label={page.own ? "Your card" : `${page.name}'s card`}>
          <Ring page={page} />
          <Who page={page} album={album} />
          <RibbonStats page={page} />
          <Share page={page} album={album} />
          <RankStrip page={page} />
        </section>
        <RarestFind page={page} />
      </aside>
      <div className="pp-e-main">
        {page.together !== null && <Together page={page} />}
        <Feed page={page} lines={4} extras />
      </div>
    </article>
  );
}

function Ring({ page }: { page: MixPage }) {
  return (
    <div className="pp-m-ring">
      <LevelRing share={levelShareOf(page.level)} level={page.level.level}>
        <MemberFace face={page.face} className="pp-b-face" />
      </LevelRing>
      {page.pet !== null && <PetHoggie pet={page.pet} owner={page.own ? "Your" : `${firstNameOf(page.name)}'s`} className="pp-m-pet" />}
    </div>
  );
}

function Who({ page, album }: { page: MixPage; album: Album }) {
  const held = page.together?.held ?? true;
  return (
    <div className="pp-m-who">
      {!page.own && <p className="pp-eyebrow">{held ? "Teammate · in your album" : "Teammate · not in your album yet"}</p>}
      <Title name={page.name} className="pp-m-name" />
      <TeamLine team={page.team} />
      <p className="pp-m-xp pp-small">
        <strong>{page.level.xp.toLocaleString("en-GB")} XP</strong>
        <span className="pp-quiet"> · {page.own ? `${xpToNextOf(page.level)} to level ${page.level.level + 1}` : `level ${page.level.level}`}</span>
      </p>
      {!held && <p className="pp-small pp-quiet pp-m-howto ph-no-capture">{howToCollectWords(album, page.person, page.name)}</p>}
    </div>
  );
}

function Share({ page, album }: { page: MixPage; album: Album }) {
  return (
    <div className="pp-m-share">
      <ShareLink album={album} page={{ kind: "person", person: page.person }} cardOf={page.own ? "your" : `${firstNameOf(page.name)}'s`} />
    </div>
  );
}

function RankStrip({ page }: { page: MixPage }) {
  return (
    <AppLink href={hrefOf({ kind: "leaderboard" })} className="pp-m-rank" data-ranked={page.rank === null ? undefined : ""}>
      {page.rank === null ? <IconHeart className="pp-m-rank-icon" /> : <IconCrown className="pp-m-rank-icon" />}
      <span className="pp-m-rank-words">
        {page.rank === null ? (
          <>
            <strong>Give a thoughtful kudos</strong> <span className="pp-quiet">to join this week's board</span>
          </>
        ) : (
          <>
            <strong>
              No. {page.rank.rank}
              {page.rank.tied ? " tied" : ""} this week
            </strong>
            <span className="pp-quiet">
              {" "}
              · {plural(page.thoughtful, "thoughtful kudos", "thoughtful kudos")}
              {page.own && page.gapAbove !== null && ` · ${page.gapAbove.gap} more to pass ${firstNameOf(page.gapAbove.name)}`}
            </span>
          </>
        )}
      </span>
      <IconArrowRight className="pp-m-rank-go" />
    </AppLink>
  );
}

function VariedStats({ page }: { page: MixPage }) {
  const { hoggies, people, emojis, medals } = page;
  return (
    <ul className="pp-d-stats">
      <li>
        <AppLink href={hrefOf({ kind: "hoggies", hoggie: null })} className="pp-d-stat pp-d-meter">
          <span className="pp-d-stat-figure">
            <strong>{hoggies.found}</strong>
            <span className="pp-quiet">/{hoggies.total}</span>
          </span>
          <Bar share={hoggies.total === 0 ? 0 : hoggies.found / hoggies.total} />
          <span className="pp-d-stat-label">hoggies found</span>
        </AppLink>
      </li>
      <li>
        <AppLink href={hrefOf({ kind: "milestones" })} className="pp-d-stat">
          <span className="pp-d-stack">
            {page.faces.length === 0 ? <span className="pp-d-empty-dot" /> : page.faces.slice(0, 3).map((person) => <MemberFace key={person.person} face={person.face} className="pp-d-stack-face" />)}
          </span>
          <span className="pp-d-stat-figure">
            <strong>{people.held}</strong>
            <span className="pp-quiet">/{people.total}</span>
          </span>
          <span className="pp-d-stat-label">people</span>
        </AppLink>
      </li>
      <li>
        <AppLink href={hrefOf({ kind: "settings" })} className="pp-d-stat">
          <span className="pp-d-stack pp-d-stack-emoji">
            {emojis.length === 0 ? <span className="pp-d-empty-dot" /> : emojis.slice(0, 4).map((emoji) => <EmojiPicture key={emoji.id} emoji={emoji} size={22} />)}
          </span>
          <span className="pp-d-stat-figure">
            <strong>{page.emojiCount}</strong>
          </span>
          <span className="pp-d-stat-label">emojis</span>
        </AppLink>
      </li>
      <li>
        <AppLink href={hrefOf({ kind: "milestones" })} className="pp-d-stat">
          <span className="pp-d-stack pp-d-stack-medals">
            {medals.length === 0 ? <span className="pp-d-empty-dot" /> : medals.slice(0, 3).map((medal) => <LadderEmblem key={medal.milestone.id} ladder={emblemOf(medal.milestone.id)} best={medal.tier.tier} size={26} />)}
          </span>
          <span className="pp-d-stat-figure">
            <strong>{page.medalCount}</strong>
          </span>
          <span className="pp-d-stat-label">medals</span>
        </AppLink>
      </li>
    </ul>
  );
}

function RibbonStats({ page }: { page: MixPage }) {
  const stats = [
    { key: "hoggies", icon: <span className="pp-hoggie-glyph">🦔</span>, figure: String(page.hoggies.found), of: page.hoggies.total, label: "hoggies", href: hrefOf({ kind: "hoggies", hoggie: null }) },
    { key: "people", icon: <IconPeople />, figure: String(page.people.held), of: page.people.total, label: "people", href: hrefOf({ kind: "milestones" }) },
    { key: "emojis", icon: <IconSparkles />, figure: String(page.emojiCount), of: undefined, label: "emojis", href: hrefOf({ kind: "settings" }) },
    { key: "medals", icon: <IconRibbon />, figure: String(page.medalCount), of: undefined, label: "medals", href: hrefOf({ kind: "milestones" }) },
  ];
  return (
    <ul className="pp-e-ribbon">
      {stats.map((stat) => (
        <li key={stat.key}>
          <AppLink href={stat.href} className="pp-e-ribbon-stat">
            <span className="pp-e-ribbon-icon" aria-hidden="true">
              {stat.icon}
            </span>
            <strong>{stat.figure}</strong>
            {stat.of !== undefined && <span className="pp-quiet pp-e-ribbon-of">/{stat.of}</span>}
            <span className="pp-e-ribbon-label">{stat.label}</span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
}

function RarestFind({ page }: { page: MixPage }) {
  const rarest = page.hoggies.rarest[0];
  const label = page.own ? "Rarest find" : `${firstNameOf(page.name)}'s rarest find`;
  return (
    <section className="pp-m-rarest" aria-label={label} style={rarest === undefined ? undefined : rarityStyle(rarest.rarity)}>
      {rarest === undefined ? (
        <div className="pp-m-rarest-main">
          <span className="pp-m-rarest-art pp-m-rarest-art-empty">?</span>
          <span className="pp-m-rarest-words">
            <span className="pp-label">{label}</span>
            <span className="pp-quiet pp-small">Give a thoughtful kudos and open its pack. Your first hoggie stands here.</span>
          </span>
        </div>
      ) : (
        <AppLink href={hrefOf({ kind: "hoggies", hoggie: rarest.hoggie })} className="pp-m-rarest-main">
          <span className="pp-m-rarest-art">
            <HoggieImage slug={rarest.hoggie} />
          </span>
          <span className="pp-m-rarest-words">
            <span className="pp-label">{label}</span>
            <strong className="pp-m-rarest-name">{rarest.name}</strong>
            <span className="pp-rarity-word">{rarityWordOf(rarest.rarity)}</span>
            {rarest.firstAt !== null && <span className="pp-quiet pp-small">Found {dateOf(rarest.firstAt)}</span>}
          </span>
        </AppLink>
      )}
      <AppLink href={hrefOf({ kind: "hoggies", hoggie: null })} className="pp-m-rarest-count pp-more">
        All hoggies <IconArrowRight />
      </AppLink>
    </section>
  );
}

function Together({ page }: { page: MixPage }) {
  const together = page.together!;
  const first = firstNameOf(page.name);
  const facts = [
    { label: "First thanked", value: together.firstThankedAt === null ? "Not yet" : dateOf(together.firstThankedAt) },
    { label: `You thanked ${first}`, value: plural(together.kudosGiven, "time", "times") },
    { label: `${first} thanked you`, value: plural(together.kudosReceived, "time", "times") },
    { label: "Hugs", value: `${together.hugsGiven} given · ${together.hugsReceived} got` },
  ];
  return (
    <section className="pp-m-together" aria-label={`You and ${first}`}>
      <div className="pp-m-together-head">
        <h2 className="pp-label">You and {first}</h2>
        {together.slackProfile !== null && (
          <SlackLink chatUrl={together.slackProfile} variant="outline">
            Open in Slack
          </SlackLink>
        )}
      </div>
      <dl className="pp-m-together-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="pp-quiet">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {together.hype.name !== null && (
        <p className="pp-small pp-m-together-hype ph-no-capture">
          <code>:{together.hype.name}:</code> <span className="pp-quiet">{together.hype.earned ? "unlocked by your first thoughtful kudos" : `give ${first} a thoughtful kudos to unlock it`}</span>
        </p>
      )}
    </section>
  );
}

function Feed({ page, lines, extras = false }: { page: MixPage; lines: number; extras?: boolean }) {
  const { week } = page;
  const issue = week.issue;
  const first = firstNameOf(page.name);
  const title = page.own ? "This week" : `${first}'s week`;
  return (
    <section className="pp-m-feed" aria-label={title} data-extras={extras ? "" : undefined}>
      <header className="pp-m-feed-head">
        <h2 className="pp-label">{title}</h2>
        <WeekBars days={issue?.days ?? [0, 0, 0, 0, 0, 0, 0]} />
        {page.own && (
          <AppLink href={hrefOf({ kind: "activity" })} className="pp-more">
            Activity <IconArrowRight />
          </AppLink>
        )}
      </header>
      {issue === null || isQuiet(issue) ? (
        <p className="pp-quiet pp-small pp-m-feed-empty">{page.own ? "Your first issue comes out the week you first thank someone or get thanked." : `A quiet week for ${first} so far.`}</p>
      ) : (
        <>
          <Tallies issue={issue} page={page} />
          {issue.kudosOfWeek !== null && (
            <figure className="pp-m-story ph-no-capture">
              <span className="pp-label">Kudos of the week</span>
              <blockquote>
                <KudosMessage message={issue.kudosOfWeek.message} clamped={false} />
              </blockquote>
              <figcaption className="pp-m-byline">
                <MemberFace face={issue.kudosOfWeek.giver.face} className="pp-face-xs" />
                <span>
                  <strong>{issue.kudosOfWeek.giver.name}</strong>
                  <span className="pp-quiet">
                    {" "}
                    to {page.own ? "you" : first} · {shortDay(issue.kudosOfWeek.at)}
                    {issue.kudosOfWeek.hugs > 0 && ` · ${plural(issue.kudosOfWeek.hugs, "hug", "hugs")}`}
                  </span>
                </span>
              </figcaption>
            </figure>
          )}
          <ul className="pp-m-said">
            {saidLinesOf(issue)
              .slice(0, lines)
              .map((line, index) => (
                <SaidLine key={`${line.kudos.at}-${index}`} line={line} page={page} />
              ))}
          </ul>
          {extras && <Extras issue={issue} page={page} />}
        </>
      )}
    </section>
  );
}

function isQuiet(issue: WeekIssue) {
  return issue.days.every((count) => count === 0) && issue.kudosOfWeek === null && issue.given.kudos.length + issue.received.kudos.length === 0;
}

const days = ["M", "T", "W", "T", "F", "S", "S"];

function WeekBars({ days: counts }: { days: number[] }) {
  const busiest = Math.max(1, ...counts);
  return (
    <span className="pp-m-bars" aria-hidden="true">
      {counts.map((count, day) => (
        <span key={day} className="pp-m-bar">
          <span className="pp-m-bar-fill" data-empty={count === 0 ? "" : undefined} style={{ "--pp-day": String(count / busiest) } as CSSProperties} />
          <span className="pp-m-bar-day">{days[day]}</span>
        </span>
      ))}
    </span>
  );
}

function Tallies({ issue, page }: { issue: WeekIssue; page: MixPage }) {
  const first = firstNameOf(page.name);
  const thanked = issue.thanked.people.length + issue.thanked.more;
  const thankedBy = issue.thankedBy.people.length + issue.thankedBy.more;
  const tallies = [
    { figure: thanked, words: page.own ? "you thanked" : `${first} thanked` },
    { figure: thankedBy, words: page.own ? "thanked you" : `thanked ${first}` },
    { figure: issue.packsOpened, words: issue.packsOpened === 1 ? "pack opened" : "packs opened" },
    { figure: issue.hugsGiven + issue.hugsReceived, words: "hugs" },
  ];
  return (
    <ul className="pp-m-tallies">
      {tallies.map((tally) => (
        <li key={tally.words}>
          <strong>{tally.figure}</strong> <span className="pp-quiet">{tally.words}</span>
        </li>
      ))}
    </ul>
  );
}

type SaidLineModel = { kudos: WeekKudos; toSubject: boolean };

function saidLinesOf(issue: WeekIssue): SaidLineModel[] {
  return [...issue.received.kudos.map((kudos) => ({ kudos, toSubject: true })), ...issue.given.kudos.map((kudos) => ({ kudos, toSubject: false }))].toSorted((one, other) => other.kudos.at - one.kudos.at);
}

function SaidLine({ line: { kudos, toSubject }, page }: { line: SaidLineModel; page: MixPage }) {
  const [person] = kudos.people;
  const subject = page.own ? "you" : firstNameOf(page.name);
  return (
    <li className="pp-m-said-line ph-no-capture">
      {person === undefined ? <span /> : <MemberFace face={person.face} className="pp-m-said-face" />}
      <div className="pp-m-said-body">
        <p className="pp-small">
          {toSubject ? (
            <>
              <strong>{names(kudos.people, kudos.morePeople)}</strong> <span className="pp-quiet">to {subject}</span>
            </>
          ) : (
            <>
              <span className="pp-quiet">{page.own ? "You" : subject} to</span> <strong>{names(kudos.people, kudos.morePeople)}</strong>
            </>
          )}
          <span className="pp-quiet"> · {shortDay(kudos.at)}</span>
        </p>
        <blockquote className="pp-m-said-words">
          <KudosMessage message={kudos.message} clamped={false} />
        </blockquote>
      </div>
    </li>
  );
}

function Extras({ issue, page }: { issue: WeekIssue; page: MixPage }) {
  const faces = issue.newFaces.people;
  const found = issue.hoggies.hoggies;
  if (faces.length + found.length === 0) return null;
  return (
    <div className="pp-m-extras">
      {faces.length > 0 && (
        <div>
          <h3 className="pp-label">New in {page.own ? "your" : `${firstNameOf(page.name)}'s`} album</h3>
          <ul className="pp-m-extra-faces">
            {faces.map((person) => (
              <li key={person.person}>
                <AppLink href={hrefOf({ kind: "person", person: person.person })} aria-label={person.name}>
                  <MemberFace face={person.face} className="pp-m-extra-face" />
                </AppLink>
              </li>
            ))}
          </ul>
        </div>
      )}
      {found.length > 0 && (
        <div>
          <h3 className="pp-label">From packs</h3>
          <ul className="pp-m-extra-hoggies">
            {found.map(({ hoggie, rarity }, index) => (
              <li key={`${hoggie}-${index}`}>
                <AppLink href={hrefOf({ kind: "hoggies", hoggie })} className="pp-m-extra-hoggie" style={rarityStyle(rarity)} aria-label={hoggie}>
                  <HoggieImage slug={hoggie} />
                </AppLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function names(people: WeekPerson[], more: number) {
  const listed = people.map(({ name }) => firstNameOf(name));
  if (more > 0) listed.push(`${more} more`);
  return listed.length <= 1 ? (listed[0] ?? "") : `${listed.slice(0, -1).join(", ")} and ${listed.at(-1)}`;
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });

function shortDay(at: number) {
  return weekday.format(at);
}
