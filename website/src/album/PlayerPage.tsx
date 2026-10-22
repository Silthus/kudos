import type { CSSProperties, ReactNode } from "react";
import { IconArrowRight, IconCrown, IconHeart } from "@posthog/icons";
import { hypeEmblemPicture, slugOf } from "../../../convex/album/emojiCatalogue";
import { AppLink } from "../AppLink";
import { KudosMessage } from "../activity/KudosMessage";
import { LadderEmblem } from "../book/LadderEmblem";
import { hoggiePictureOf } from "../crates/Hoggie";
import { TeamCrest } from "../crates/TeamCrest";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import { AnswerPage } from "../pages/AnswerPage";
import { LoadingPage } from "../pages/LoadingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { SlackLink } from "../SlackLink";
import type { Album, CardEmojisShown, KudosOfTheWeek, PersonPage, PersonShown, PlayerCard, PlayerCardAnswer, PlayerCardReads, PlayerCardShown, WeekPerson, WeekShown } from "./answer";
import { levelShareOf, plural, xpToNextOf } from "./facts";
import { emblemOf } from "./milestones";
import { rarityWordOf } from "./opening";
import { PetHoggie, petOf } from "./PetHoggie";
import { OwnHypePick, type HypePicker } from "./OwnHypePick";
import { findYourselfHref, hrefOf, type Place } from "./place";
import { isAQuietCard, isAQuietWeek, ownWeekOf, teammateWeekOf, type EmojiStack, type PageWeek, type SaidLine } from "./playerPage";
import { ShareLink } from "./ShareLink";
import { dateOf, firstNameOf, howToCollectWords } from "./teamPage";
import "./playerPage.css";

type Answers = { onSignIn: () => void; onSignOut: () => void };

export type PlayerReads = { cards: PlayerCardReads; week: WeekShown | undefined; together: PersonShown | undefined };

type PlayerAnswerProps = { album: Album; own: boolean; reads: PlayerReads; picker: HypePicker } & Answers;

type Page = { own: boolean; card: PlayerCard; emojis: EmojiStack | null; week: PageWeek; together: PersonPage | null; hypePick: PersonPage | null };

type Failed = Exclude<PlayerCardShown | WeekShown | PersonShown, { kind: "card" | "week" | "person" }>;

export function PlayerAnswerPage({ album, own, reads, picker, ...answers }: PlayerAnswerProps) {
  const failed = failureOf(own, reads);
  if (failed !== undefined) return failed.kind === "off" || failed.kind === "no-person" ? <NotFoundPage /> : <AnswerPage answer={failed} {...answers} />;
  const page = pageOf(own, reads);
  if (page === null) return <LoadingPage shape="column" />;
  return <PlayerPage album={album} page={page} picker={picker} />;
}

export function isWaitingForThePlayer(own: boolean, reads: PlayerReads) {
  return failureOf(own, reads) === undefined && pageOf(own, reads) === null;
}

export function playerAskedAt(place: Place, album: Album): string | null {
  if (album.personPageD !== true) return null;
  if (place.kind === "profile") return album.me.person;
  return place.kind === "person" ? place.person : null;
}

function readsOf(own: boolean, { cards, week, together }: PlayerReads) {
  return [cards.card, own ? week : together];
}

function failureOf(own: boolean, reads: PlayerReads): Failed | undefined {
  return readsOf(own, reads).find((read): read is Failed => read !== undefined && !["card", "week", "person"].includes(read.kind));
}

function pageOf(own: boolean, { cards: { card, emojis }, week, together }: PlayerReads): Page | null {
  if (card?.kind !== "card") return null;
  const shown = { own, card: card.card, emojis: emojis?.kind === "emojis" ? emojis : null };
  if (own) return week?.kind === "week" ? { ...shown, week: ownWeekOf(week), together: null, hypePick: together?.kind === "person" && together.hypePick === true ? together : null } : null;
  return together?.kind === "person" ? { ...shown, week: teammateWeekOf(cardWeekOf(card)), together, hypePick: null } : null;
}

function cardWeekOf({ week }: PlayerCardAnswer) {
  return week ?? { days: [0, 0, 0, 0, 0, 0, 0], thanked: 0, thankedBy: 0, packsOpened: 0, hugs: 0, kudosOfWeek: null };
}

function PlayerPage({ album, page, picker }: { album: Album; page: Page; picker: HypePicker }) {
  return (
    <article className="al-page-body al-pp">
      <section className="al-pp-card" aria-label={page.own ? "Your card" : `${page.card.name}'s card`}>
        <header className="al-pp-id">
          <Ring album={album} page={page} />
          <Who album={album} page={page} />
          <div className="al-pp-share">
            <ShareLink album={album} page={{ kind: "person", person: page.card.person }} cardOf={page.own ? "your" : `${firstNameOf(page.card.name)}'s`} />
          </div>
        </header>
        <RankStrip page={page} />
        {isAQuietCard(page.card, page.emojis) ? <QuietStats page={page} /> : <Stats album={album} page={page} />}
      </section>
      {page.hypePick !== null && <YourHypeEmoji person={page.hypePick} emojiPage={album.emojiPage} picker={picker} />}
      {page.card.hoggies !== null && <RarestFind page={page} />}
      {page.together !== null && <Together name={page.card.name} together={page.together} />}
      <Week page={page} />
    </article>
  );
}

function Ring({ album, page: { own, card } }: { album: Album; page: Page }) {
  const pet = petOf(album, card.person);
  const face = <MemberFace face={card.face} className="al-pp-face" />;
  return (
    <div className="al-pp-mount">
      {card.level === null ? <span className="al-pp-ring">{face}</span> : <LevelRing share={levelShareOf(card.level)} level={card.level.level}>{face}</LevelRing>}
      {pet !== null && <PetHoggie pet={pet} owner={own ? "Your" : `${firstNameOf(card.name)}'s`} className="al-pp-pet" />}
    </div>
  );
}

function LevelRing({ share, level, children }: { share: number; level: number; children: ReactNode }) {
  const radius = 54;
  const length = 2 * Math.PI * radius;
  return (
    <div className="al-pp-ring" role="img" aria-label={`Level ${level}, ${Math.round(share * 100)}% to the next`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} className="al-pp-ring-track" />
        <circle cx="60" cy="60" r={radius} className="al-pp-ring-fill" strokeDasharray={length} strokeDashoffset={length * (1 - Math.max(0.03, share))} />
      </svg>
      <span className="al-pp-ring-face">{children}</span>
      <span className="al-pp-ring-level" aria-hidden="true">
        <span>Lv</span>
        {level}
      </span>
    </div>
  );
}

function Who({ album, page: { own, card, together } }: { album: Album; page: Page }) {
  const held = together?.held ?? true;
  return (
    <div className="al-pp-who">
      {!own && <p className="al-pp-eyebrow">{held ? "Teammate · in your album" : "Teammate · not in your album yet"}</p>}
      <PageTitle tab={own ? "Profile" : card.name}>
        <span className="ph-no-capture al-pp-name">{card.name}</span>
      </PageTitle>
      <TeamLine team={card.team} own={own} />
      {card.level !== null && (
        <p className="al-pp-xp al-pp-small">
          <strong>{card.level.xp.toLocaleString("en-GB")} XP</strong>
          <span className="al-pp-quiet"> {own ? `· ${xpToNextOf(card.level).toLocaleString("en-GB")} to level ${card.level.level + 1}` : `· level ${card.level.level}`}</span>
        </p>
      )}
      {!held && <p className="al-pp-small al-pp-quiet al-pp-howto ph-no-capture">{howToCollectWords(album, card.person, card.name)}</p>}
    </div>
  );
}

function TeamLine({ team, own }: { team: PlayerCard["team"]; own: boolean }) {
  if (team === null && own)
    return (
      <AppLink href={findYourselfHref} className="al-pp-small al-pp-more">
        Find your team
      </AppLink>
    );
  if (team === null) return <span className="al-pp-quiet al-pp-small">No team yet</span>;
  return (
    <AppLink href={hrefOf({ kind: "team", team: team.team })} className="al-pp-team">
      <TeamCrest art={team.art} size={20} name={team.name} />
      <span>{team.name}</span>
    </AppLink>
  );
}

function RankStrip({ page: { own, card } }: { page: Page }) {
  const { place } = card;
  return (
    <AppLink href={hrefOf({ kind: "leaderboard" })} className="al-pp-rank" data-ranked={place === null ? undefined : ""}>
      {place === null ? <IconHeart className="al-pp-rank-icon" /> : <IconCrown className="al-pp-rank-icon" />}
      <span className="al-pp-rank-words">
        {place === null ? (
          <strong>{own ? "Give a thoughtful kudos to join this week's board" : "Not on this week's board yet"}</strong>
        ) : (
          <>
            <strong>
              No. {place.rank}
              {place.tied ? " tied" : ""} this week
            </strong>{" "}
            <span className="al-pp-quiet">· {plural(place.thoughtful, "thoughtful kudos", "thoughtful kudos")}</span>
          </>
        )}
      </span>
      <IconArrowRight className="al-pp-rank-go" />
    </AppLink>
  );
}

function Stats({ album, page: { own, card, emojis } }: { album: Album; page: Page }) {
  const { hoggies, people, medals } = card;
  const owner = own ? "Your" : `${firstNameOf(card.name)}'s`;
  return (
    <ul className="al-pp-stats" aria-label={`${owner} stats`}>
      {hoggies !== null && (
        <Stat href={own ? hrefOf({ kind: "hoggies", hoggie: null }) : null} label={`${hoggies.found} of ${hoggies.total} hoggies found`} meter>
          <span className="al-pp-stat-figure">
            <strong>{hoggies.found}</strong>
            <span className="al-pp-quiet">/{hoggies.total}</span>
          </span>
          <Bar share={hoggies.total === 0 ? 0 : hoggies.found / hoggies.total} />
          <span className="al-pp-stat-label">hoggies found</span>
        </Stat>
      )}
      <Stat href={own ? hrefOf({ kind: "milestones" }) : null} label={own ? `${people.held} of ${album.people.length} people` : plural(people.held, "person", "people")}>
        <Stack>{people.newest.map((person) => <MemberFace key={person.person} face={person.face} className="al-pp-stack-face" />)}</Stack>
        <span className="al-pp-stat-figure">
          <strong>{people.held}</strong>
          {own && <span className="al-pp-quiet">/{album.people.length}</span>}
        </span>
        <span className="al-pp-stat-label">people</span>
      </Stat>
      {emojis !== null && (
        <Stat href={null} label={plural(emojis.count, "emoji", "emojis")}>
          <Stack className="al-pp-stack-emoji">{emojis.shown.map(({ name, picture }) => <img key={name} src={picture} alt="" width={22} height={22} draggable={false} />)}</Stack>
          <span className="al-pp-stat-figure">
            <strong>{emojis.count}</strong>
          </span>
          <span className="al-pp-stat-label">emojis</span>
        </Stat>
      )}
      <Stat href={own ? hrefOf({ kind: "milestones" }) : null} label={plural(medals.count, "medal", "medals")}>
        <Stack className="al-pp-stack-medals">{medals.best.map(({ milestone, tier }) => <LadderEmblem key={milestone} ladder={emblemOf(milestone)} best={tier} size={26} />)}</Stack>
        <span className="al-pp-stat-figure">
          <strong>{medals.count}</strong>
        </span>
        <span className="al-pp-stat-label">medals</span>
      </Stat>
    </ul>
  );
}

function Stat({ href, label, meter = false, children }: { href: string | null; label: string; meter?: boolean; children: ReactNode }) {
  const className = `al-pp-stat${meter ? " al-pp-meter" : ""}`;
  return (
    <li>
      {href !== null ? (
        <AppLink href={href} className={className} aria-label={label}>
          {children}
        </AppLink>
      ) : (
        <span className={className} role="group" aria-label={label}>
          {children}
        </span>
      )}
    </li>
  );
}

function Stack({ className = "", children }: { className?: string; children: ReactNode[] }) {
  return <span className={`al-pp-stack ${className}`}>{children.length === 0 ? <span className="al-pp-empty-dot" /> : children}</span>;
}

function QuietStats({ page: { own, card } }: { page: Page }) {
  return <p className="al-pp-quiet-stats al-pp-small">{own ? "Thank a teammate and say why: your first person, hoggie and emoji land here." : `${firstNameOf(card.name)}'s album is just getting started.`}</p>;
}

function Bar({ share }: { share: number }) {
  return (
    <span className="al-pp-bar-track" aria-hidden="true">
      <span className="al-pp-bar-fill" style={{ width: `${Math.max(3, Math.min(1, share) * 100)}%` }} />
    </span>
  );
}

function RarestFind({ page: { own, card } }: { page: Page }) {
  const rarest = card.hoggies?.rarest ?? null;
  const label = own ? "Rarest find" : `${firstNameOf(card.name)}'s rarest find`;
  return (
    <section className="al-pp-rarest" aria-label={label} style={rarest === null ? undefined : rarityStyle(rarest.rarity)}>
      {rarest === null ? (
        <div className="al-pp-rarest-main">
          <span className="al-pp-rarest-art al-pp-rarest-art-empty" aria-hidden="true">
            ?
          </span>
          <span className="al-pp-rarest-words">
            <span className="al-pp-label">{label}</span>
            <span className="al-pp-quiet al-pp-small">{own ? "Give a thoughtful kudos and open its pack. Your first hoggie stands here." : "No hoggie found yet."}</span>
          </span>
        </div>
      ) : (
        <FoundHoggie href={own ? hrefOf({ kind: "hoggies", hoggie: rarest.hoggie }) : null}>
          <span className="al-pp-rarest-art">
            <HoggieImage slug={rarest.hoggie} />
          </span>
          <span className="al-pp-rarest-words">
            <span className="al-pp-label">{label}</span>
            <strong className="al-pp-rarest-name">{rarest.name}</strong>
            <span className="al-pp-rarity-word">{rarityWordOf(rarest.rarity)}</span>
            <span className="al-pp-quiet al-pp-small">Found {dateOf(rarest.firstAt)}</span>
          </span>
        </FoundHoggie>
      )}
      {own && (
        <AppLink href={hrefOf({ kind: "hoggies", hoggie: null })} className="al-pp-rarest-count al-pp-more">
          All hoggies <IconArrowRight aria-hidden="true" />
        </AppLink>
      )}
    </section>
  );
}

function FoundHoggie({ href, children }: { href: string | null; children: ReactNode }) {
  return href === null ? (
    <div className="al-pp-rarest-main">{children}</div>
  ) : (
    <AppLink href={href} className="al-pp-rarest-main">
      {children}
    </AppLink>
  );
}

function YourHypeEmoji({ person, emojiPage, picker }: { person: PersonPage; emojiPage: string | null; picker: HypePicker }) {
  const { name, picture, inSlack } = person.hype;
  return (
    <section className="al-pp-together" aria-label="Your hype emoji">
      <div className="al-pp-together-head">
        <h2 className="al-pp-label">Your hype emoji</h2>
        <OwnHypePick emoji={{ kind: "hype", name: name ?? `${slugOf(person.name)}-hype`, picture: picture ?? hypeEmblemPicture, from: person.name, inSlack: inSlack ?? false }} emojiPage={emojiPage} {...picker} />
      </div>
      {name !== null && (
        <p className="al-pp-small ph-no-capture">
          <code>:{name}:</code>
        </p>
      )}
    </section>
  );
}

function HoggieImage({ slug }: { slug: string }) {
  const picture = hoggiePictureOf({ kind: "hoggie", slug });
  return picture === undefined ? null : <img src={picture} alt="" draggable={false} />;
}

function rarityStyle(rarity: string): CSSProperties {
  return { "--al-pp-rarity": `var(--rarity-${rarity})` } as CSSProperties;
}

function Together({ name, together }: { name: string; together: PersonPage }) {
  const first = firstNameOf(name);
  const facts = [
    { label: "First thanked", value: together.firstThankedAt === null ? "Not yet" : dateOf(together.firstThankedAt) },
    { label: `You thanked ${first}`, value: plural(together.kudosGiven, "time", "times") },
    { label: `${first} thanked you`, value: plural(together.kudosReceived, "time", "times") },
    { label: "Hugs", value: `${together.hugsGiven} given · ${together.hugsReceived} got` },
  ];
  return (
    <section className="al-pp-together" aria-label={`You and ${first}`}>
      <div className="al-pp-together-head">
        <h2 className="al-pp-label">You and {first}</h2>
        {together.slackProfile !== null && (
          <SlackLink chatUrl={together.slackProfile} variant="outline">
            Open in Slack<span className="sr-only">, {first}&apos;s profile</span>
          </SlackLink>
        )}
      </div>
      <dl className="al-pp-together-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="al-pp-quiet">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {together.hype.name !== null && (
        <p className="al-pp-small al-pp-together-hype ph-no-capture">
          <code>:{together.hype.name}:</code> <span className="al-pp-quiet">{together.hype.earned ? "unlocked by your first thoughtful kudos" : `give ${first} a thoughtful kudos to unlock it`}</span>
        </p>
      )}
    </section>
  );
}

function Week({ page: { own, card, week } }: { page: Page }) {
  const first = firstNameOf(card.name);
  const title = own ? "This week" : `${first}'s week`;
  return (
    <section className="al-pp-feed" aria-label={title}>
      <header className="al-pp-feed-head">
        <h2 className="al-pp-label">{title}</h2>
        <DayBars days={week.days} />
        {own && (
          <AppLink href={hrefOf({ kind: "activity" })} className="al-pp-more">
            Activity <IconArrowRight aria-hidden="true" />
          </AppLink>
        )}
      </header>
      {isAQuietWeek(week) ? (
        <p className="al-pp-quiet al-pp-small al-pp-feed-empty">{own ? "Your week fills in as you thank someone or get thanked." : `A quiet week for ${first} so far.`}</p>
      ) : (
        <>
          <Tallies week={week} subject={own ? null : first} />
          {week.kudosOfWeek !== null && <KudosOfWeek kudos={week.kudosOfWeek} />}
          {week.lines !== null && week.lines.length > 0 && (
            <ul className="al-pp-said" aria-label="Latest kudos">
              {week.lines.map((line, index) => (
                <Said key={`${line.kudos.at}-${index}`} line={line} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

const dayNames = ["M", "T", "W", "T", "F", "S", "S"];

const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DayBars({ days }: { days: number[] }) {
  const busiest = Math.max(1, ...days);
  return (
    <span className="al-pp-days" role="img" aria-label={`Kudos by day: ${days.map((count, day) => `${weekdayNames[day]} ${count}`).join(", ")}`}>
      {days.map((count, day) => (
        <span key={day} className="al-pp-day" aria-hidden="true">
          <span className="al-pp-day-fill" data-empty={count === 0 ? "" : undefined} style={{ "--al-pp-day": String(count / busiest) } as CSSProperties} />
          <span className="al-pp-day-name">{dayNames[day]}</span>
        </span>
      ))}
    </span>
  );
}

function Tallies({ week, subject }: { week: PageWeek; subject: string | null }) {
  const tallies = [
    { figure: week.thanked, words: subject === null ? "you thanked" : `${subject} thanked` },
    { figure: week.thankedBy, words: subject === null ? "thanked you" : `thanked ${subject}` },
    { figure: week.packsOpened, words: week.packsOpened === 1 ? "pack opened" : "packs opened" },
    { figure: week.hugs, words: week.hugs === 1 ? "hug" : "hugs" },
  ];
  return (
    <ul className="al-pp-tallies">
      {tallies.map((tally) => (
        <li key={tally.words}>
          <strong>{tally.figure}</strong> <span className="al-pp-quiet">{tally.words}</span>
        </li>
      ))}
    </ul>
  );
}

function KudosOfWeek({ kudos }: { kudos: KudosOfTheWeek }) {
  return (
    <figure className="al-pp-story ph-no-capture" aria-label="Kudos of the week">
      <span className="al-pp-label" aria-hidden="true">
        Kudos of the week
      </span>
      <blockquote>
        <KudosMessage message={kudos.message} clamped={false} />
      </blockquote>
      <figcaption className="al-pp-byline">
        <MemberFace face={kudos.giver.face} className="al-pp-face-xs" />
        <span>
          <strong>{kudos.giver.name}</strong>
          <span className="al-pp-quiet">
            {" "}
            · {shortDay(kudos.at)}
            {kudos.hugs > 0 && ` · ${plural(kudos.hugs, "hug", "hugs")}`}
          </span>
        </span>
        {kudos.permalink !== null && (
          <SlackLink chatUrl={kudos.permalink} variant="outline">
            Open in Slack
          </SlackLink>
        )}
      </figcaption>
    </figure>
  );
}

function Said({ line: { kudos, toSubject } }: { line: SaidLine }) {
  const [person] = kudos.people;
  return (
    <li className="al-pp-said-line ph-no-capture">
      {person === undefined ? <span /> : <MemberFace face={person.face} className="al-pp-said-face" />}
      <div className="al-pp-said-body">
        <p className="al-pp-small">
          {toSubject ? (
            <>
              <strong>{names(kudos.people, kudos.morePeople)}</strong> <span className="al-pp-quiet">to you</span>
            </>
          ) : (
            <>
              <span className="al-pp-quiet">You to</span> <strong>{names(kudos.people, kudos.morePeople)}</strong>
            </>
          )}
          <span className="al-pp-quiet"> · {shortDay(kudos.at)}</span>
        </p>
        <blockquote className="al-pp-said-words">
          <KudosMessage message={kudos.message} clamped={false} />
        </blockquote>
      </div>
    </li>
  );
}

function names(people: WeekPerson[], more: number) {
  const listed = people.map(({ name }) => firstNameOf(name));
  if (more > 0) listed.push(`${more} more`);
  return listed.length <= 1 ? (listed[0] ?? "") : `${listed.slice(0, -1).join(", ")} and ${listed.at(-1)}`;
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

function shortDay(at: number) {
  return weekday.format(at);
}
