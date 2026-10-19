import { Fragment, useId } from "react";
import { AppLink } from "../AppLink";
import { TeamCrest } from "../crates/TeamCrest";
import { TeamEmojiPicture } from "./TeamEmojiPicture";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import type { Album, AlbumEmoji, AlbumTeam } from "./answer";
import { plural } from "./facts";
import { hrefOf } from "./place";
import { SealArt } from "./Seal";
import { Silhouette } from "./Silhouette";
import { dateOf, inSlackWords, nameOnThePhoto, nextStepOf, nextStepWords, onThePhotoOf, teamEmojiOf, type OnThePhoto } from "./teamPage";
import type { TeamUnlocking } from "./useTeamUnlock";
import "./team.css";

const sealSize = 128;

export function TeamPage({ album, team, unlocking }: { album: Album; team: AlbumTeam; unlocking: TeamUnlocking }) {
  const onThePhoto = onThePhotoOf(album, team);
  const emoji = teamEmojiOf(album, team.team);
  const caption = useId();
  return (
    <article className="al-page-body al-team-page">
      <header>
        <p className="al-eyebrow">{team.mine ? "Your team" : "Team page"}</p>
        <PageTitle tab={team.name} size="hero">
          {team.name}
        </PageTitle>
        <p className="al-lede">{plural(onThePhoto.length, "person", "people")}</p>
      </header>
      <figure className="al-mount" aria-labelledby={caption}>
        <ul className="al-photo" data-size={onThePhoto.length > 5 ? "many" : "few"}>
          {onThePhoto.map((shown) => (
            <PhotoPerson key={shown.kind === "person" ? shown.person.person : `unmatched:${shown.name}`} shown={shown} />
          ))}
        </ul>
        <figcaption id={caption} className="al-photo-caption">
          <span className="al-photo-caption-label">Left to right</span> <Caption onThePhoto={onThePhoto} />
        </figcaption>
        <Seal team={team} emoji={emoji} />
      </figure>
      <Goal album={album} team={team} emoji={emoji} unlocking={unlocking} />
    </article>
  );
}

function PhotoPerson({ shown }: { shown: OnThePhoto }) {
  if (shown.kind === "unmatched")
    return (
      <li className="al-photo-person" data-out="">
        <Silhouette name={shown.name} />
        <span className="al-photo-name ph-no-capture">{shown.name}</span>{" "}
        <span className="al-photo-role">Not in Slack yet</span>
      </li>
    );
  const { person, name, face, held } = shown.person;
  return (
    <li className="al-photo-person" data-out={held ? undefined : ""}>
      <AppLink href={hrefOf({ kind: "person", person })} className="al-photo-link">
        {held ? (
          <span className="al-photo-sticker">
            <MemberFace face={face} className="al-photo-face" />
          </span>
        ) : (
          <Silhouette name={name} />
        )}
        <span className="al-photo-name ph-no-capture">{name}</span>{" "}
        <span className="al-photo-role">{held ? "In your album" : "Not in your album yet"}</span>
      </AppLink>
    </li>
  );
}

function Caption({ onThePhoto }: { onThePhoto: OnThePhoto[] }) {
  return (
    <span className="ph-no-capture">
      {onThePhoto.map((shown, index) => (
        <Fragment key={index}>
          <span data-out={shown.kind === "person" && shown.person.held ? undefined : ""}>{nameOnThePhoto(shown)}</span>
          {index < onThePhoto.length - 1 ? ", " : ""}
        </Fragment>
      ))}
    </span>
  );
}

function Seal({ team, emoji }: { team: AlbumTeam; emoji: AlbumEmoji | undefined }) {
  return (
    <div className="al-seal-spot">
      <div className="al-seal" data-state={team.state} data-al-seal={team.team} role="img" aria-label={sealLabelOf(team)}>
        <SealArt team={team} coloured={team.state === "unlocked"} size={sealSize} />
        {team.state === "ready" && (
          <>
            <span className="al-seal-shimmer" aria-hidden="true" />
            <span className="al-seal-ribbon">Ready to unlock</span>
          </>
        )}
      </div>
      {team.state === "unlocked" && (
        <p className="al-seal-tag">
          <span>Unlocked {dateOf(team.unlockedAt ?? 0)}</span>
          {emoji !== undefined && <code className="ph-no-capture">:{emoji.name}:</code>}
        </p>
      )}
    </div>
  );
}

function sealLabelOf(team: AlbumTeam) {
  if (team.state === "unlocked") return `${team.name} sticker, unlocked`;
  if (team.state === "ready") return `${team.name} sticker, ready to unlock`;
  return `${team.name} sticker, ${team.held} of ${team.total}`;
}

function Goal({ album, team, emoji, unlocking }: { album: Album; team: AlbumTeam; emoji: AlbumEmoji | undefined; unlocking: TeamUnlocking }) {
  const heading = useId();
  return (
    <section className="al-goal" data-state={team.state} data-al-goal="" aria-labelledby={heading}>
      <h2 id={heading} tabIndex={-1} className="al-eyebrow al-goal-heading">
        {goalHeadingOf(team)}
      </h2>
      <GoalWords album={album} team={team} unlocking={unlocking} />
      {team.state === "unlocked" && emoji !== undefined && <TeamEmojiLine team={team} emoji={emoji} />}
      <p role="status" className="al-goal-problem">
        {team.state === "ready" && unlocking.problem?.team === team.team ? problemWordsOf(unlocking.problem.reason, team) : ""}
      </p>
    </section>
  );
}

function goalHeadingOf(team: AlbumTeam) {
  if (team.state === "unlocked") return `Unlocked ${dateOf(team.unlockedAt ?? 0)}`;
  return team.state === "ready" ? "Ready to unlock" : "Collect the whole team";
}

function GoalWords({ album, team, unlocking }: { album: Album; team: AlbumTeam; unlocking: TeamUnlocking }) {
  if (team.state === "unlocked") return <p className="al-goal-words">The {team.name} sticker is yours.</p>;
  if (team.state === "ready")
    return (
      <>
        <p className="al-goal-words">
          {team.total} of {team.total} in your album. Everyone is in.
        </p>
        <div className="al-goal-next">
          <p>Every {team.name} card is in. Unlock your team sticker!</p>
          <UnlockButton team={team} unlocking={unlocking} />
        </div>
      </>
    );
  if (team.total === 0) return <p className="al-goal-words">Nobody else on {team.name} is in Slack yet, so there's nobody to collect.</p>;
  const step = nextStepOf(album, team);
  return (
    <>
      <p className="al-goal-words">
        {team.held} of {team.total} in your album. Collect all {team.total} to unlock the {team.name} sticker.
      </p>
      {step !== null && <p className="al-goal-next ph-no-capture">{nextStepWords(step, team)}</p>}
    </>
  );
}

function UnlockButton({ team, unlocking }: { team: AlbumTeam; unlocking: TeamUnlocking }) {
  const sending = unlocking.sending === team.team;
  const unavailable = unlocking.sending !== null || unlocking.waits;
  return (
    <button type="button" className="al-unlock" aria-disabled={unavailable || undefined} onClick={unavailable ? undefined : () => unlocking.start(team.team)}>
      <LockOpen />
      {unlockWordsOf(team, sending, unlocking.waits)}
    </button>
  );
}

function unlockWordsOf(team: AlbumTeam, sending: boolean, waits: boolean) {
  if (sending) return "Unlocking…";
  return waits ? "Waiting for your cards to land…" : `Unlock the ${team.name} sticker`;
}

function LockOpen() {
  return (
    <svg viewBox="0 0 24 24" className="al-unlock-icon" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V7.5a4 4 0 0 1 7.6-1.8" fill="none" />
    </svg>
  );
}

function problemWordsOf(reason: "refused" | "unreachable", team: AlbumTeam) {
  return reason === "refused" ? `The ${team.name} sticker couldn't be unlocked. Reload the page to see where it stands.` : "Couldn't reach HedgeHug. Try again.";
}

function TeamEmojiLine({ team, emoji }: { team: AlbumTeam; emoji: AlbumEmoji }) {
  const inSlack = inSlackWords(emoji);
  return (
    <p className="al-emoji-line ph-no-capture">
      <span className="al-emoji-picture">
        <TeamEmojiPicture art={team.art} name={team.name} emoji={emoji} size={32} />
      </span>
      <code>:{emoji.name}:</code>
      <span> is your team emoji.{inSlack === null ? "" : ` ${inSlack.charAt(0).toUpperCase()}${inSlack.slice(1)}.`}</span>
    </p>
  );
}
