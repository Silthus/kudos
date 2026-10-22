import { useId, type CSSProperties, type ReactNode } from "react";
import { KudosMessage } from "../activity/KudosMessage";
import { AnswerPage } from "../pages/AnswerPage";
import { AppLink } from "../AppLink";
import { LadderEmblem } from "../book/LadderEmblem";
import { Medal } from "../book/Medal";
import { hoggiePictureOf } from "../crates/Hoggie";
import { TeamCrest } from "../crates/TeamCrest";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import { LoadingPage } from "../pages/LoadingPage";
import { SlackLink } from "../SlackLink";
import type { Album, AlbumHoggies, AlbumLevel, AlbumProfile, AlbumTeam, BoardsShown, FoundHoggie, HoggiesShown, KindNote, NewestPerson, ProfileShown, ThoughtfulBoards } from "./answer";
import { levelShareOf, myTeamOf, xpToNextOf } from "./facts";
import { countedWords, emblemOf, milestoneNameOf, progressWords, tierWordOf } from "./milestones";
import { rarityWordOf } from "./opening";
import { findYourselfHref, hrefOf } from "./place";
import { bestMedalsOf, closestNextOf, highestEarnedOf, peopleGlanceOf, rankWords, rarestShown, shareOf, standingOf, teamFootnoteOf, teamRankWords, type BestMedal, type NextMedal, type Standing } from "./profile";
import { dateOf } from "./teamPage";
import { ShareLink } from "./ShareLink";
import "./team.css";
import "./profile.css";
import { isPrototypeShell, useVariant } from "./prototype/personPagePrototype";
import { ProfileVariant } from "./prototype/ProfileVariants";

type ProfileAnswerProps = { album: Album; profile: ProfileShown | undefined; boards: BoardsShown | undefined; hoggies: HoggiesShown | undefined; onSignIn: () => void; onSignOut: () => void };

type ProfileReads = { profile: ProfileShown | undefined; boards: BoardsShown | undefined; hoggies: HoggiesShown | undefined };

type Answered = { profile: AlbumProfile; boards: ThoughtfulBoards; hoggies: AlbumHoggies | null };

export function ProfileAnswerPage({ album, profile, boards, hoggies, ...answers }: ProfileAnswerProps) {
  const reads = { profile, boards, hoggies };
  const answered = answeredOf(reads);
  if (answered !== null && isPrototypeShell) return <PrototypeProfile album={album} answered={answered} />;
  if (answered !== null) return <ProfilePage album={album} profile={answered.profile} standing={standingOf(answered.boards, myTeamOf(album)?.team ?? null)} hoggies={answered.hoggies} />;
  const failed = failureOf(reads);
  if (failed !== undefined) return <AnswerPage answer={failed} {...answers} />;
  return <LoadingPage shape="column" />;
}

function PrototypeProfile({ album, answered }: { album: Album; answered: Answered }) {
  const variant = useVariant();
  if (variant === "now") return <ProfilePage album={album} profile={answered.profile} standing={standingOf(answered.boards, myTeamOf(album)?.team ?? null)} hoggies={answered.hoggies} />;
  return <ProfileVariant variant={variant} album={album} profile={answered.profile} boards={answered.boards} hoggies={answered.hoggies} />;
}

export function isWaitingForTheProfile(reads: ProfileReads) {
  return answeredOf(reads) === null && failureOf(reads) === undefined;
}

function answeredOf({ profile, boards, hoggies }: ProfileReads): Answered | null {
  if (profile?.kind !== "profile" || boards?.kind !== "boards" || hoggies === undefined) return null;
  return { profile, boards, hoggies: hoggies.kind === "hoggies" ? hoggies : null };
}

function failureOf({ profile, boards }: ProfileReads) {
  return [profile, boards].find(isAFailure);
}

function isAFailure(read: ProfileShown | BoardsShown | undefined): read is Exclude<ProfileShown | BoardsShown, AlbumProfile | ThoughtfulBoards | { kind: "off" }> {
  return read !== undefined && read.kind !== "off" && read.kind !== "profile" && read.kind !== "boards";
}

function ProfilePage({ album, profile, standing, hoggies }: { album: Album; profile: AlbumProfile; standing: Standing; hoggies: AlbumHoggies | null }) {
  const team = myTeamOf(album);
  return (
    <article className="al-page-body al-profile">
      <div className="al-profile-top">
        <Entry album={album} team={team} note={profile.note} />
        <Rank standing={standing} />
      </div>
      {team === undefined && <FindYourTeam />}
      <Glance album={album} team={team} hoggies={hoggies} />
      <Finds album={album} newest={profile.newest} hoggies={hoggies} />
      <BestMilestones album={album} />
    </article>
  );
}

function Entry({ album, team, note }: { album: Album; team: AlbumTeam | undefined; note: KindNote | null }) {
  const caption = useId();
  return (
    <div className="al-profile-entry">
      <figure className="al-mount al-mount-single al-profile-mount" aria-labelledby={caption}>
        <div className="al-photo">
          <span className="al-photo-sticker al-photo-sticker-large">
            <MemberFace face={album.me.face} className="al-photo-face" />
          </span>
        </div>
        <figcaption id={caption} className="al-photo-caption ph-no-capture">
          {team === undefined ? album.me.name : `${album.me.name}, ${team.name}`}
        </figcaption>
      </figure>
      <div className="al-profile-words">
        <p className="al-eyebrow">Your page</p>
        <PageTitle tab="Profile" size="hero">
          <span className="ph-no-capture">{album.me.name}</span>
        </PageTitle>
        {team !== undefined && (
          <AppLink href={hrefOf({ kind: "team", team: team.team })} className="al-person-team al-profile-team">
            <TeamCrest art={team.art} size={32} name={team.name} collected={team.held > 0} />
            <strong>{team.name}</strong>
            {team.total > 0 && (
              <>
                {" "}
                <span className="al-quiet">
                  · {team.held} of {team.total} in your album
                </span>
              </>
            )}
          </AppLink>
        )}
        <Level level={album.level} />
        <ShareLink album={album} page={{ kind: "person", person: album.me.person }} cardOf="your" />
        {note !== null && <Note note={note} />}
      </div>
    </div>
  );
}

function FindYourTeam() {
  return (
    <Section title="Find your team">
      <div className="al-profile-find">
        <p className="al-lede">Your team's page joins your album once you're matched to your profile on posthog.com.</p>
        <MoreLink href={findYourselfHref}>Find yourself on posthog.com</MoreLink>
      </div>
    </Section>
  );
}

function Level({ level }: { level: AlbumLevel }) {
  const words = `${xpToNextOf(level)} XP to level ${level.level + 1}`;
  return (
    <div className="al-profile-level">
      <span className="al-level">Level {level.level}</span>
      <div className="al-profile-level-way">
        <Bar label={words} now={level.xp} min={level.startsAt} max={level.nextAt} share={levelShareOf(level)} />
        <span className="al-profile-level-words">
          <span>{level.xp.toLocaleString("en-GB")} XP</span>
          <span className="al-quiet">{words}</span>
        </span>
      </div>
    </div>
  );
}

function Bar({ label, now, min, max, share }: { label?: string; now?: number; min?: number; max?: number; share: number }) {
  const fill = <span className="al-profile-bar-fill" style={{ width: `${Math.max(3, share * 100)}%` }} />;
  if (label === undefined)
    return (
      <span className="al-profile-bar" aria-hidden="true">
        {fill}
      </span>
    );
  return (
    <span role="progressbar" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={now} className="al-profile-bar">
      {fill}
    </span>
  );
}

function Note({ note }: { note: KindNote }) {
  const label = useId();
  return (
    <figure className="al-quote al-profile-note ph-no-capture" aria-labelledby={label}>
      <p id={label} className="al-profile-note-label">
        Someone wrote to you
      </p>
      <blockquote>
        <KudosMessage message={note.message} clamped={false} />
      </blockquote>
      <figcaption>
        <AppLink href={hrefOf({ kind: "person", person: note.giver.person })} className="al-profile-note-by">
          <MemberFace face={note.giver.face} className="al-profile-face-small" />
          <span>
            {note.giver.name}, {dateOf(note.at)}
          </span>
        </AppLink>
        {note.permalink !== null && (
          <SlackLink chatUrl={note.permalink} variant="outline">
            Open in Slack
          </SlackLink>
        )}
      </figcaption>
    </figure>
  );
}

function Rank({ standing }: { standing: Standing }) {
  const heading = useId();
  return (
    <section className="al-profile-rank" aria-labelledby={heading}>
      <h2 id={heading} className="al-eyebrow">
        This week's thoughtful kudos
      </h2>
      <YourPlace standing={standing} />
      {standing.team !== null && (
        <p className="al-profile-rank-team">
          <TeamCrest art={standing.team.art} size={28} name={standing.team.name} />
          <span>{teamRankWords(standing.team)}</span>
        </p>
      )}
      <MoreLink href={hrefOf({ kind: "leaderboard" })}>See the leaderboard</MoreLink>
    </section>
  );
}

function YourPlace({ standing: { me, onTheBoards } }: { standing: Standing }) {
  if (!onTheBoards)
    return (
      <p className="al-profile-rank-line">
        You're off the boards by choice. Switch on "Show me on the leaderboards" in <AppLink href={hrefOf({ kind: "settings" })}>Settings</AppLink> to come back.
      </p>
    );
  if (me === null || me.rank === null) return <p className="al-profile-rank-line">Give a thoughtful kudos to join this week's board.</p>;
  return (
    <>
      <p className="al-profile-rank-number">{rankWords({ rank: me.rank, tied: me.tied })}</p>
      <p className="al-profile-rank-line">{me.thoughtful} thoughtful kudos given</p>
    </>
  );
}

function MoreLink({ href, children }: { href: string; children: string }) {
  return (
    <AppLink href={href} className="al-profile-more">
      {children} <span aria-hidden="true">→</span>
    </AppLink>
  );
}

export function Section({ title, more, children }: { title: string; more?: ReactNode; children: ReactNode }) {
  const heading = useId();
  return (
    <section className="al-profile-section" aria-labelledby={heading}>
      <div className="al-profile-section-head">
        <h2 id={heading} className="al-profile-heading">
          {title}
        </h2>
        {more}
      </div>
      {children}
    </section>
  );
}

function Glance({ album, team, hoggies }: { album: Album; team: AlbumTeam | undefined; hoggies: AlbumHoggies | null }) {
  const people = peopleGlanceOf(album);
  return (
    <Section title="Your album at a glance">
      <ul className="al-profile-glance">
        <Tile href={hrefOf({ kind: "milestones" })} label="People in your album" held={people.held} total={people.total} footnote={`${people.unlocked} of ${people.teams} team stickers unlocked`} />
        {team !== undefined && <Tile href={hrefOf({ kind: "team", team: team.team })} label={`Your team, ${team.name}`} held={team.held} total={team.total} footnote={teamFootnoteOf(team)} art={<TeamCrest art={team.art} size={44} name={team.name} collected={team.held > 0} />} />}
        {hoggies !== null && <Tile href={hrefOf({ kind: "hoggies", hoggie: null })} label="Hoggies found" held={hoggies.found} total={hoggies.total} footnote={`${hoggies.total - hoggies.found} still hiding in packs`} />}
      </ul>
    </Section>
  );
}

function Tile({ href, label, held, total, footnote, art }: { href: string; label: string; held: number; total: number; footnote: string; art?: ReactNode }) {
  const foot = useId();
  return (
    <li>
      <AppLink href={href} className="al-profile-tile" aria-label={total === 0 ? label : `${label}: ${held} of ${total}`} aria-describedby={foot}>
        <span className="al-profile-tile-top">
          <span className="al-profile-tile-label">{label}</span>
          {art}
        </span>
        {total > 0 && (
          <>
            <span className="al-profile-tile-count">
              <strong>{held}</strong>
              <span className="al-quiet"> of {total}</span>
            </span>
            <Bar share={held / total} />
          </>
        )}
        <span id={foot} className="al-profile-tile-foot al-quiet">
          {footnote}
        </span>
      </AppLink>
    </li>
  );
}

function Finds({ album, newest, hoggies }: { album: Album; newest: NewestPerson[]; hoggies: AlbumHoggies | null }) {
  const rarest = hoggies?.rarest.slice(0, rarestShown) ?? [];
  const listed = useId();
  return (
    <Section title="Coolest finds" more={hoggies !== null && <MoreLink href={hrefOf({ kind: "hoggies", hoggie: null })}>All your hoggies</MoreLink>}>
      {rarest.length === 0 && newest.length === 0 ? (
        <p className="al-lede">Give a thoughtful kudos and open its pack: your first person and hoggie show here.</p>
      ) : (
        <div className="al-profile-finds">
          {rarest.length > 0 && (
            <ul className="al-profile-hoggies" aria-label="Your rarest hoggies">
              {rarest.map((hoggie) => (
                <HoggieCard key={hoggie.hoggie} hoggie={hoggie} />
              ))}
            </ul>
          )}
          {newest.length > 0 && (
            <div className="al-profile-newest">
              <h3 id={listed} className="al-profile-subheading">
                New in your album
              </h3>
              <ul aria-labelledby={listed}>
                {newest.map((person) => (
                  <NewestRow key={person.person} album={album} person={person} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function HoggieCard({ hoggie: { hoggie, name, rarity, firstAt } }: { hoggie: FoundHoggie }) {
  const picture = hoggiePictureOf({ kind: "hoggie", slug: hoggie });
  return (
    <li>
      <AppLink href={hrefOf({ kind: "hoggies", hoggie })} className="al-profile-hoggie" style={{ "--al-rarity": `var(--rarity-${rarity})` } as CSSProperties}>
        <span className="al-profile-hoggie-art">{picture !== undefined && <img src={picture} alt="" draggable={false} />}</span>
        <span className="al-profile-hoggie-rarity">{rarityWordOf(rarity)}</span>
        <strong>{name}</strong>
        {firstAt !== null && <span className="al-quiet al-profile-small">First found {dateOf(firstAt)}</span>}
      </AppLink>
    </li>
  );
}

function NewestRow({ album, person: { person, name, face, at } }: { album: Album; person: NewestPerson }) {
  const team = teamNameOf(album, person);
  return (
    <li>
      <AppLink href={hrefOf({ kind: "person", person })} className="al-profile-person ph-no-capture" aria-label={`${name}, ${team}, joined ${dateOf(at)}`}>
        <MemberFace face={face} className="al-profile-face" />
        <span className="al-profile-person-words">
          <strong>{name}</strong>
          <span className="al-quiet">{team}</span>
        </span>
        <span className="al-quiet al-profile-small">{dateOf(at)}</span>
      </AppLink>
    </li>
  );
}

function teamNameOf(album: Album, person: string) {
  const first = album.people.find((listed) => listed.person === person)?.teams[0];
  return album.teams.find(({ team }) => team === first)?.name ?? "Teammate";
}

function BestMilestones({ album }: { album: Album }) {
  const best = bestMedalsOf(album);
  const next = closestNextOf(album);
  return (
    <Section title="Best milestones" more={<MoreLink href={hrefOf({ kind: "milestones" })}>All milestones</MoreLink>}>
      <div className="al-profile-best">
        {best.length === 0 ? (
          <p className="al-lede">No medals yet.</p>
        ) : (
          <ul className="al-profile-medals" aria-label="Your best medals">
            {best.map((medal) => (
              <BestCard key={medal.milestone.id} medal={medal} />
            ))}
          </ul>
        )}
        {next !== null && <ClosestNext next={next} />}
      </div>
    </Section>
  );
}

function BestCard({ medal: { milestone, tier } }: { medal: BestMedal }) {
  return (
    <li className="al-profile-medal">
      <LadderEmblem ladder={emblemOf(milestone.id)} best={tier.tier} size={80} />
      <span className="al-profile-tier">
        <Medal tier={tier.tier} earned size={20} />
        {tierWordOf(tier.tier)}
      </span>
      <strong>{tier.name}</strong>
      <span className="al-quiet al-profile-small">
        {milestoneNameOf(milestone.id)} · {countedWords(milestone.id, tier.at)}
      </span>
      <span className="al-quiet al-profile-small">Earned {dateOf(tier.earnedAt)}</span>
    </li>
  );
}

function ClosestNext({ next }: { next: NextMedal }) {
  const label = useId();
  const { milestone, tier } = next;
  const words = progressWords(milestone.id, milestone.count, tier.at);
  const best = highestEarnedOf(milestone)?.tier ?? null;
  return (
    <div role="group" aria-labelledby={label} className="al-profile-next">
      <p id={label} className="al-eyebrow">
        Closest next
      </p>
      <div className="al-profile-next-row">
        <LadderEmblem ladder={emblemOf(milestone.id)} best={best} size={64} />
        <div className="al-profile-next-words">
          <span className="al-profile-tier">
            <Medal tier={tier.tier} earned={false} size={18} />
            {tierWordOf(tier.tier)}
          </span>
          <strong>{tier.name}</strong>
          <span className="al-quiet al-profile-small">{milestoneNameOf(milestone.id)}</span>
        </div>
      </div>
      <Bar label={`${words} for ${tier.name}`} now={Math.min(milestone.count, tier.at)} min={0} max={tier.at} share={shareOf(next)} />
      <p className="al-profile-next-way al-profile-small">
        <span>{words}</span>
        <span className="al-quiet">{Math.max(0, tier.at - milestone.count)} to go</span>
      </p>
    </div>
  );
}
