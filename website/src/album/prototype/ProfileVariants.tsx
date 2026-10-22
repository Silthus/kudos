// PROTOTYPE (throwaway): three structurally different layouts of your own person page (#me).
// A Player card: identity and the headline numbers, like the Slack link card.
// B Next goals: the level ring and every goal you're closest to.
// C Trophy shelf: the rarest find, medals, emojis and kind words on display.
import type { CSSProperties, ReactNode } from "react";
import { IconArrowRight, IconCrown, IconHeart, IconPeople, IconRibbon, IconSparkles } from "@posthog/icons";
import { AppLink } from "../../AppLink";
import { LadderEmblem } from "../../book/LadderEmblem";
import { Medal } from "../../book/Medal";
import { hoggiePictureOf } from "../../crates/Hoggie";
import { TeamCrest } from "../../crates/TeamCrest";
import { MemberFace } from "../../Face";
import { PageTitle } from "../../PageTitle";
import { KudosMessage } from "../../activity/KudosMessage";
import type { Album, AlbumEmoji, AlbumHoggies, AlbumMilestone, AlbumProfile, AlbumTeam, FoundHoggie, KindNote, ThoughtfulBoards } from "../answer";
import { EmojiPicture } from "../EmojiPicture";
import { earnedEmojisOf, levelShareOf, medalsOf, myTeamOf, xpToNextOf } from "../facts";
import { emblemOf, milestoneNameOf, progressWords, tierWordOf } from "../milestones";
import { rarityWordOf } from "../opening";
import { PetHoggie, petOf } from "../PetHoggie";
import { hrefOf } from "../place";
import { bestMedalsOf, closestNextOf, peopleGlanceOf, shareOf, type BestMedal } from "../profile";
import { ShareLink } from "../ShareLink";
import { dateOf } from "../teamPage";
import "./profileVariants.css";

type Reads = { album: Album; profile: AlbumProfile; boards: ThoughtfulBoards; hoggies: AlbumHoggies | null };

type Facts = ReturnType<typeof factsOf>;

function factsOf({ album, profile, boards, hoggies }: Reads) {
  const team = myTeamOf(album);
  const me = boards.pinned.me;
  const rank = boards.onTheBoards && me !== null && me.rank !== null ? { rank: me.rank, tied: me.tied } : null;
  const above = rank === null ? null : (boards.people.filter((person) => person.rank !== null && person.rank < rank.rank).at(-1) ?? null);
  return {
    album,
    team,
    level: album.level,
    toNext: xpToNextOf(album.level),
    levelShare: levelShareOf(album.level),
    rank,
    thoughtful: me?.thoughtful ?? 0,
    gapAbove: above === null || me === null ? null : { name: above.name, gap: Math.max(1, above.thoughtful - me.thoughtful + 1) },
    teamStanding: boards.pinned.teams.find(({ team: slug }) => slug === team?.team) ?? null,
    people: peopleGlanceOf(album),
    hoggies: { found: hoggies?.found ?? 0, total: hoggies?.total ?? 0, rarest: (hoggies?.rarest ?? []) as FoundHoggie[] },
    emojis: album.emojis.filter(({ earned }) => earned),
    lockedEmojis: album.emojis.filter(({ earned, progress }) => !earned && progress !== null),
    emojiCount: earnedEmojisOf(album),
    medalCount: medalsOf(album),
    best: bestMedalsOf(album),
    next: closestNextOf(album),
    note: profile.note,
    newest: profile.newest,
    pet: petOf(album, album.me.person),
  };
}

export function ProfileVariant({ variant, ...reads }: Reads & { variant: "a" | "b" | "c" }) {
  const facts = factsOf(reads);
  if (variant === "a") return <PlayerCard facts={facts} />;
  if (variant === "b") return <NextGoals facts={facts} />;
  return <TrophyShelf facts={facts} />;
}

function rankWords(facts: Facts) {
  if (facts.rank === null) return "Not ranked yet";
  return `No. ${facts.rank.rank}${facts.rank.tied ? " tied" : ""}`;
}

export function Title({ name, className }: { name: string; className: string }) {
  return (
    <PageTitle tab="Profile">
      <span className={`ph-no-capture ${className}`}>{name}</span>
    </PageTitle>
  );
}

export function HoggieImage({ slug }: { slug: string }) {
  const picture = hoggiePictureOf({ kind: "hoggie", slug });
  return picture === undefined ? null : <img src={picture} alt="" draggable={false} />;
}

export function rarityStyle(rarity: string): CSSProperties {
  return { "--pp-rarity": `var(--rarity-${rarity})` } as CSSProperties;
}

export function Bar({ share, className = "" }: { share: number; className?: string }) {
  return (
    <span className={`pp-bar-track ${className}`} aria-hidden="true">
      <span className="pp-bar-fill" style={{ width: `${Math.max(3, Math.min(1, share) * 100)}%` }} />
    </span>
  );
}

export function TeamLine({ team }: { team: AlbumTeam | undefined }) {
  if (team === undefined) return <span className="pp-quiet">No team yet</span>;
  return (
    <AppLink href={hrefOf({ kind: "team", team: team.team })} className="pp-team">
      <TeamCrest art={team.art} size={20} name={team.name} collected={team.held > 0} />
      <span>{team.name}</span>
    </AppLink>
  );
}

function NoteQuote({ note, clamp }: { note: KindNote; clamp: boolean }) {
  return (
    <figure className="pp-note ph-no-capture" data-clamp={clamp ? "" : undefined}>
      <blockquote>
        <KudosMessage message={note.message} clamped={false} />
      </blockquote>
      <figcaption>
        <AppLink href={hrefOf({ kind: "person", person: note.giver.person })} className="pp-note-by">
          <MemberFace face={note.giver.face} className="pp-face-xs" />
          <span>
            {note.giver.name} · {dateOf(note.at)}
          </span>
        </AppLink>
      </figcaption>
    </figure>
  );
}

/* ───────────── A: Player card ───────────── */

function PlayerCard({ facts }: { facts: Facts }) {
  const { album, level } = facts;
  return (
    <article className="pp-a">
      <div className="pp-a-card">
        <header className="pp-a-id">
          <div className="pp-a-photo">
            <span className="pp-a-sticker">
              <MemberFace face={album.me.face} className="pp-a-face" />
            </span>
            {facts.pet !== null && <PetHoggie pet={facts.pet} owner="Your" className="pp-a-pet" />}
          </div>
          <div className="pp-a-who">
            <p className="pp-eyebrow">Your page</p>
            <Title name={album.me.name} className="pp-a-name" />
            <TeamLine team={facts.team} />
          </div>
          <div className="pp-a-share">
            <ShareLink album={album} page={{ kind: "person", person: album.me.person }} cardOf="your" />
          </div>
        </header>
        <div className="pp-a-level">
          <span className="pp-level-chip">Level {level.level}</span>
          <Bar share={facts.levelShare} className="pp-a-level-bar" />
          <span className="pp-a-level-words">
            <strong>{level.xp.toLocaleString("en-GB")} XP</strong>
            <span className="pp-quiet">{facts.toNext} to level {level.level + 1}</span>
          </span>
        </div>
        <ul className="pp-a-stats">
          <Stat href={hrefOf({ kind: "leaderboard" })} icon={<IconCrown />} value={facts.rank === null ? "–" : rankWords(facts)} label={facts.rank === null ? "not ranked yet" : "this week"} tone="gold" />
          <Stat href={hrefOf({ kind: "leaderboard" })} icon={<IconHeart />} value={String(facts.thoughtful)} label="thoughtful kudos" />
          <Stat href={hrefOf({ kind: "hoggies", hoggie: null })} icon={<HoggieGlyph />} value={String(facts.hoggies.found)} of={facts.hoggies.total} label="hoggies" />
          <Stat href={hrefOf({ kind: "milestones" })} icon={<IconPeople />} value={String(facts.people.held)} of={facts.people.total} label="people" />
          <Stat href={hrefOf({ kind: "settings" })} icon={<IconSparkles />} value={String(facts.emojiCount)} label="emojis" />
          <Stat href={hrefOf({ kind: "milestones" })} icon={<IconRibbon />} value={String(facts.medalCount)} label="medals" />
        </ul>
      </div>
      <section className="pp-a-row" aria-label="Rarest hoggies">
        <h2 className="pp-label">Rarest finds</h2>
        {facts.hoggies.rarest.length === 0 ? (
          <div className="pp-a-hoggies">
            {[0, 1, 2, 3, 4].map((slot) => (
              <span key={slot} className="pp-a-hoggie pp-a-hoggie-empty" />
            ))}
            <span className="pp-quiet pp-small">Open a pack to find your first</span>
          </div>
        ) : (
          <ul className="pp-a-hoggies">
            {facts.hoggies.rarest.slice(0, 5).map((hoggie) => (
              <li key={hoggie.hoggie}>
                <AppLink href={hrefOf({ kind: "hoggies", hoggie: hoggie.hoggie })} className="pp-a-hoggie" style={rarityStyle(hoggie.rarity)} aria-label={`${hoggie.name}, ${rarityWordOf(hoggie.rarity)}`}>
                  <HoggieImage slug={hoggie.hoggie} />
                </AppLink>
              </li>
            ))}
            <li className="pp-a-hoggie-words">
              <strong>{facts.hoggies.rarest[0]!.name}</strong>
              <span style={rarityStyle(facts.hoggies.rarest[0]!.rarity)} className="pp-rarity-word">
                {rarityWordOf(facts.hoggies.rarest[0]!.rarity)}
              </span>
            </li>
          </ul>
        )}
      </section>
      <section className="pp-a-row" aria-label="Medals">
        <h2 className="pp-label">Medals</h2>
        <div className="pp-a-medals">
          {facts.best.map((medal) => (
            <AppLink key={medal.milestone.id} href={hrefOf({ kind: "milestones" })} className="pp-a-medal" aria-label={`${tierWordOf(medal.tier.tier)}: ${medal.tier.name}`}>
              <LadderEmblem ladder={emblemOf(medal.milestone.id)} best={medal.tier.tier} size={44} />
            </AppLink>
          ))}
          {facts.next !== null && (
            <AppLink href={hrefOf({ kind: "milestones" })} className="pp-a-next">
              <span className="pp-small pp-quiet">Next</span>
              <strong className="pp-small">{facts.next.tier.name}</strong>
              <Bar share={shareOf(facts.next)} />
              <span className="pp-small pp-quiet">{progressWords(facts.next.milestone.id, facts.next.milestone.count, facts.next.tier.at)}</span>
            </AppLink>
          )}
        </div>
      </section>
      {facts.note !== null ? (
        <section className="pp-a-row" aria-label="Someone wrote to you">
          <h2 className="pp-label">Someone wrote to you</h2>
          <NoteQuote note={facts.note} clamp />
        </section>
      ) : (
        <p className="pp-quiet pp-small pp-a-empty-note">Kind words people write to you show up here.</p>
      )}
    </article>
  );
}

function Stat({ href, icon, value, of, label, tone }: { href: string; icon: ReactNode; value: string; of?: number; label: string; tone?: "gold" }) {
  return (
    <li>
      <AppLink href={href} className="pp-a-stat" data-tone={tone}>
        <span className="pp-a-stat-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="pp-a-stat-value">
          {value}
          {of !== undefined && <span className="pp-a-stat-of">/{of}</span>}
        </span>
        <span className="pp-a-stat-label">{label}</span>
      </AppLink>
    </li>
  );
}

function HoggieGlyph() {
  return <span className="pp-hoggie-glyph">🦔</span>;
}

/* ───────────── B: Next goals ───────────── */

type Goal = { key: string; art: ReactNode; title: string; detail: string; share: number; toGo: string; href: string };

function goalsOf(facts: Facts): Goal[] {
  const { album, team, next, people, hoggies } = facts;
  const goals: Goal[] = [];
  if (team !== undefined && team.total > 0 && team.state !== "unlocked")
    goals.push({ key: "team", art: <TeamCrest art={team.art} size={36} name={team.name} collected={team.held > 0} />, title: `${team.name} team sticker`, detail: `${team.held} of ${team.total} teammates in your album`, share: team.held / team.total, toGo: team.state === "ready" ? "Ready!" : `${team.total - team.held} to go`, href: hrefOf({ kind: "team", team: team.team }) });
  if (next !== null)
    goals.push({ key: "medal", art: <LadderEmblem ladder={emblemOf(next.milestone.id)} best={null} size={36} />, title: `${tierWordOf(next.tier.tier)} medal: ${next.tier.name}`, detail: progressWords(next.milestone.id, next.milestone.count, next.tier.at), share: shareOf(next), toGo: next.milestone.count >= next.tier.at ? "Ready!" : `${next.tier.at - next.milestone.count} to go`, href: hrefOf({ kind: "milestones" }) });
  const lockedEmoji = facts.lockedEmojis.filter(({ kind }) => kind !== "milestone").toSorted((one, other) => progressShare(other) - progressShare(one))[0];
  if (lockedEmoji !== undefined && lockedEmoji.progress !== null)
    goals.push({ key: "emoji", art: <EmojiPicture emoji={lockedEmoji} size={36} locked />, title: `:${lockedEmoji.name}: emoji`, detail: `${lockedEmoji.progress.have} of ${lockedEmoji.progress.need}`, share: progressShare(lockedEmoji), toGo: lockedEmoji.progress.have >= lockedEmoji.progress.need ? "Ready!" : `${lockedEmoji.progress.need - lockedEmoji.progress.have} to go`, href: hrefOf({ kind: "settings" }) });
  goals.push({ key: "hoggies", art: <span className="pp-b-goal-glyph">🦔</span>, title: "Hoggies found", detail: `${hoggies.found} of ${hoggies.total}`, share: hoggies.total === 0 ? 0 : hoggies.found / hoggies.total, toGo: `${hoggies.total - hoggies.found} hiding`, href: hrefOf({ kind: "hoggies", hoggie: null }) });
  goals.push({ key: "people", art: <IconPeople className="pp-b-goal-icon" />, title: "People in your album", detail: `${people.held} of ${people.total} · ${people.unlocked} of ${people.teams} team stickers`, share: people.total === 0 ? 0 : people.held / people.total, toGo: `${people.total - people.held} to meet`, href: hrefOf({ kind: "milestones" }) });
  void album;
  return goals;
}

function progressShare({ progress }: AlbumEmoji) {
  return progress === null || progress.need === 0 ? 0 : Math.min(1, progress.have / progress.need);
}

function NextGoals({ facts }: { facts: Facts }) {
  const { album, level } = facts;
  const goals = goalsOf(facts);
  return (
    <article className="pp-b">
      <header className="pp-b-hero">
        <LevelRing share={facts.levelShare} level={level.level}>
          <MemberFace face={album.me.face} className="pp-b-face" />
        </LevelRing>
        <div className="pp-b-who">
          <Title name={album.me.name} className="pp-b-name" />
          <TeamLine team={facts.team} />
          <p className="pp-b-xp">
            <strong>{level.xp.toLocaleString("en-GB")} XP</strong> <span className="pp-quiet">· {facts.toNext} to level {level.level + 1}</span>
          </p>
          <div className="pp-b-chips">
            <AppLink href={hrefOf({ kind: "leaderboard" })} className="pp-chip" data-tone={facts.rank === null ? undefined : "gold"}>
              <IconCrown /> {facts.rank === null ? "Unranked" : `${rankWords(facts)} this week`}
            </AppLink>
            <span className="pp-chip">
              <IconRibbon /> {facts.medalCount} medals
            </span>
            <span className="pp-chip">
              <IconSparkles /> {facts.emojiCount} emojis
            </span>
            <span className="pp-b-share">
              <ShareLink album={album} page={{ kind: "person", person: album.me.person }} cardOf="your" />
            </span>
          </div>
        </div>
      </header>
      <section className="pp-b-board" aria-label="This week">
        <IconHeart className="pp-b-board-icon" />
        {facts.rank === null ? (
          <p>
            <strong>Give a thoughtful kudos</strong> <span className="pp-quiet">to join this week's board.</span>
          </p>
        ) : (
          <p>
            <strong>{facts.thoughtful} thoughtful kudos</strong> this week
            {facts.gapAbove !== null ? (
              <span className="pp-quiet">
                {" "}
                · {facts.gapAbove.gap} more to pass {facts.gapAbove.name.split(" ")[0]}
              </span>
            ) : (
              <span className="pp-quiet"> · you lead the board</span>
            )}
          </p>
        )}
        <AppLink href={hrefOf({ kind: "leaderboard" })} className="pp-more">
          Board <IconArrowRight />
        </AppLink>
      </section>
      <section className="pp-b-goals" aria-labelledby="pp-b-goals">
        <h2 id="pp-b-goals" className="pp-label">
          Closest next
        </h2>
        <ol>
          {goals.map((goal) => (
            <li key={goal.key}>
              <AppLink href={goal.href} className="pp-b-goal">
                <span className="pp-b-goal-art">{goal.art}</span>
                <span className="pp-b-goal-words">
                  <span className="pp-b-goal-top">
                    <strong>{goal.title}</strong>
                    <span className="pp-b-goal-togo">{goal.toGo}</span>
                  </span>
                  <Bar share={goal.share} />
                  <span className="pp-quiet pp-small">{goal.detail}</span>
                </span>
              </AppLink>
            </li>
          ))}
        </ol>
      </section>
      {facts.note !== null && (
        <AppLink href={hrefOf({ kind: "person", person: facts.note.giver.person })} className="pp-b-note ph-no-capture">
          <MemberFace face={facts.note.giver.face} className="pp-face-xs" />
          <span className="pp-b-note-words">
            <strong>{facts.note.giver.name.split(" ")[0]} wrote to you:</strong> <span className="pp-quiet">“{plainOf(facts.note)}”</span>
          </span>
        </AppLink>
      )}
    </article>
  );
}

function plainOf(note: KindNote) {
  const message = note.message;
  if (message.kind !== "text") return "";
  return message.segments.map((segment) => ("text" in segment ? segment.text : "")).join("");
}

export function LevelRing({ share, level, children }: { share: number; level: number; children: ReactNode }) {
  const radius = 54;
  const length = 2 * Math.PI * radius;
  return (
    <div className="pp-b-ring" role="img" aria-label={`Level ${level}, ${Math.round(share * 100)}% to the next`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} className="pp-b-ring-track" />
        <circle cx="60" cy="60" r={radius} className="pp-b-ring-fill" strokeDasharray={length} strokeDashoffset={length * (1 - Math.max(0.03, share))} />
      </svg>
      <span className="pp-b-ring-face">{children}</span>
      <span className="pp-b-ring-level">
        <span>Lv</span>
        {level}
      </span>
    </div>
  );
}

/* ───────────── C: Trophy shelf ───────────── */

function TrophyShelf({ facts }: { facts: Facts }) {
  const { album, level } = facts;
  const [rarest, ...others] = facts.hoggies.rarest;
  return (
    <article className="pp-c">
      <header className="pp-c-id">
        <MemberFace face={album.me.face} className="pp-c-face" />
        <div className="pp-c-who">
          <Title name={album.me.name} className="pp-c-name" />
          <span className="pp-c-line">
            <TeamLine team={facts.team} />
            <span className="pp-c-level">
              Level {level.level}
              <Bar share={facts.levelShare} className="pp-c-level-bar" />
            </span>
            <AppLink href={hrefOf({ kind: "leaderboard" })} className="pp-c-rank">
              <IconCrown /> {facts.rank === null ? "Unranked" : `${rankWords(facts)} this week`}
            </AppLink>
          </span>
        </div>
        <div className="pp-c-share">
          <ShareLink album={album} page={{ kind: "person", person: album.me.person }} cardOf="your" />
        </div>
      </header>
      <div className="pp-c-grid">
        <section className="pp-c-tile pp-c-hero" aria-label="Rarest find" style={rarest === undefined ? undefined : rarityStyle(rarest.rarity)}>
          {rarest === undefined ? (
            <div className="pp-c-hero-empty">
              <span className="pp-c-hero-art pp-c-hero-art-empty">?</span>
              <p className="pp-label">Your rarest find</p>
              <p className="pp-quiet pp-small">Give a thoughtful kudos and open its pack. Your first hoggie stands here.</p>
            </div>
          ) : (
            <>
              <AppLink href={hrefOf({ kind: "hoggies", hoggie: rarest.hoggie })} className="pp-c-hero-main">
                <span className="pp-c-hero-art">
                  <HoggieImage slug={rarest.hoggie} />
                </span>
                <span className="pp-c-hero-words">
                  <span className="pp-label">Rarest find</span>
                  <strong className="pp-c-hero-name">{rarest.name}</strong>
                  <span className="pp-rarity-word">{rarityWordOf(rarest.rarity)}</span>
                  {rarest.firstAt !== null && <span className="pp-quiet pp-small">Found {dateOf(rarest.firstAt)}</span>}
                </span>
              </AppLink>
              <ul className="pp-c-runners">
                {others.slice(0, 4).map((hoggie) => (
                  <li key={hoggie.hoggie}>
                    <AppLink href={hrefOf({ kind: "hoggies", hoggie: hoggie.hoggie })} className="pp-c-runner" style={rarityStyle(hoggie.rarity)} aria-label={`${hoggie.name}, ${rarityWordOf(hoggie.rarity)}`}>
                      <HoggieImage slug={hoggie.hoggie} />
                    </AppLink>
                  </li>
                ))}
              </ul>
            </>
          )}
          <AppLink href={hrefOf({ kind: "hoggies", hoggie: null })} className="pp-c-count">
            <strong>{facts.hoggies.found}</strong>
            <span className="pp-quiet">/{facts.hoggies.total} hoggies</span>
          </AppLink>
        </section>
        <section className="pp-c-tile pp-c-medals" aria-label="Medals">
          <h2 className="pp-label">Medal shelf</h2>
          <ul className="pp-c-shelf">
            {shelfOf(facts.best, album.milestones).map((slot) => (
              <li key={slot.id} className="pp-c-shelf-slot" data-empty={slot.medal === null ? "" : undefined}>
                <LadderEmblem ladder={emblemOf(slot.id)} best={slot.medal?.tier.tier ?? null} size={48} />
                {slot.medal !== null && (
                  <span className="pp-c-shelf-tier">
                    <Medal tier={slot.medal.tier.tier} earned size={14} />
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="pp-small pp-c-caption">{facts.best[0] === undefined ? "Your first medal sits here." : `${tierWordOf(facts.best[0].tier.tier)} · ${facts.best[0].tier.name}`}</p>
          <AppLink href={hrefOf({ kind: "milestones" })} className="pp-c-count">
            <strong>{facts.medalCount}</strong>
            <span className="pp-quiet"> medals</span>
          </AppLink>
        </section>
        <section className="pp-c-tile pp-c-emojis" aria-label="Emojis">
          <h2 className="pp-label">Emojis</h2>
          <ul className="pp-c-emoji-grid">
            {(facts.emojis.length > 0 ? facts.emojis : facts.lockedEmojis).slice(0, 8).map((emoji) => (
              <li key={emoji.id} title={`:${emoji.name}:`}>
                <EmojiPicture emoji={emoji} size={30} locked={!emoji.earned} />
              </li>
            ))}
          </ul>
          <AppLink href={hrefOf({ kind: "settings" })} className="pp-c-count">
            <strong>{facts.emojiCount}</strong>
            <span className="pp-quiet"> unlocked</span>
          </AppLink>
        </section>
        <section className="pp-c-tile pp-c-note" aria-label="Someone wrote to you">
          {facts.note !== null ? (
            <>
              <h2 className="pp-label">Someone wrote to you</h2>
              <NoteQuote note={facts.note} clamp />
            </>
          ) : (
            <>
              <h2 className="pp-label">Kind words</h2>
              <p className="pp-quiet pp-small">When someone thanks you and says why, their words hang here.</p>
            </>
          )}
        </section>
        <section className="pp-c-tile pp-c-people" aria-label="People in your album">
          <h2 className="pp-label">In your album</h2>
          <div className="pp-c-faces">
            {facts.newest.slice(0, 4).map((person) => (
              <AppLink key={person.person} href={hrefOf({ kind: "person", person: person.person })} aria-label={person.name}>
                <MemberFace face={person.face} className="pp-c-face-sm" />
              </AppLink>
            ))}
          </div>
          <AppLink href={hrefOf({ kind: "milestones" })} className="pp-c-count">
            <strong>{facts.people.held}</strong>
            <span className="pp-quiet">/{facts.people.total} people</span>
          </AppLink>
        </section>
      </div>
    </article>
  );
}

function shelfOf(best: BestMedal[], milestones: AlbumMilestone[]) {
  const shown = best.map((medal) => ({ id: medal.milestone.id, medal }));
  const rest = milestones.filter(({ id }) => !shown.some((slot) => slot.id === id)).map(({ id }) => ({ id, medal: null }));
  return [...shown, ...rest].slice(0, 4);
}
