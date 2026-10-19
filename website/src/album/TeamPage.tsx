import { Fragment, useId } from "react";
import { AppLink } from "../AppLink";
import { TeamCrest } from "../crates/TeamCrest";
import { TeamEmojiPicture } from "./TeamEmojiPicture";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import { AddToSlackButton } from "./AddToSlackButton";
import type { Album, AlbumEmoji, AlbumTeam } from "./answer";
import { plural } from "./facts";
import { hrefOf } from "./place";
import { SealArt } from "./Seal";
import { Silhouette } from "./Silhouette";
import { dateOf, nameOnThePhoto, onThePhotoOf, teamEmojiOf, teamEmojiUseWords, type OnThePhoto } from "./teamPage";
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
        <Seal team={team} emoji={emoji} unlocking={unlocking} />
      </figure>
      <p role="status" aria-label="Unlocking the sticker" className="al-unlock-problem">
        {team.state === "ready" && unlocking.problem?.team === team.team ? problemWordsOf(unlocking.problem.reason, team) : ""}
      </p>
      {team.state === "unlocked" && emoji !== undefined && <TeamEmojiLine team={team} emoji={emoji} emojiPage={album.emojiPage} />}
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

function Seal({ team, emoji, unlocking }: { team: AlbumTeam; emoji: AlbumEmoji | undefined; unlocking: TeamUnlocking }) {
  return (
    <div className="al-seal-spot">
      {team.state === "ready" ? (
        <UnlockSeal team={team} unlocking={unlocking} />
      ) : (
        <div className="al-seal" data-state={team.state} data-al-seal={team.team} role="img" aria-label={sealLabelOf(team)}>
          <SealArt team={team} coloured={team.state === "unlocked"} size={sealSize} />
        </div>
      )}
      {team.state === "unlocked" && (
        <p className="al-seal-tag">
          <span tabIndex={-1} data-al-unlocked="">
            Unlocked {dateOf(team.unlockedAt ?? 0)}
          </span>
          {emoji !== undefined && <code className="ph-no-capture">:{emoji.name}:</code>}
        </p>
      )}
    </div>
  );
}

function UnlockSeal({ team, unlocking }: { team: AlbumTeam; unlocking: TeamUnlocking }) {
  const sending = unlocking.sending === team.team;
  const unavailable = unlocking.sending !== null || unlocking.waits;
  const busyWords = busyWordsOf(sending, unlocking.waits);
  return (
    <button
      type="button"
      className="al-seal"
      data-state="ready"
      data-al-seal={team.team}
      aria-label={busyWords ?? `Ready to unlock the ${team.name} sticker`}
      aria-disabled={unavailable || undefined}
      onClick={unavailable ? undefined : () => unlocking.start(team.team)}
    >
      <SealArt team={team} coloured={false} size={sealSize} />
      <span className="al-seal-shimmer" aria-hidden="true" />
      <span className="al-seal-ribbon">{busyWords ?? "Ready to unlock"}</span>
    </button>
  );
}

function busyWordsOf(sending: boolean, waits: boolean) {
  if (sending) return "Unlocking…";
  return waits ? "Waiting for your cards to land…" : null;
}

function sealLabelOf(team: AlbumTeam) {
  return team.state === "unlocked" ? `${team.name} sticker, unlocked` : `${team.name} sticker, ${team.held} of ${team.total}`;
}

function problemWordsOf(reason: "refused" | "unreachable", team: AlbumTeam) {
  return reason === "refused" ? `The ${team.name} sticker couldn't be unlocked. Reload the page to see where it stands.` : "Couldn't reach HedgeHug. Try again.";
}

function TeamEmojiLine({ team, emoji, emojiPage }: { team: AlbumTeam; emoji: AlbumEmoji; emojiPage: string | null }) {
  return (
    <div className="al-emoji-line ph-no-capture">
      <span className="al-emoji-picture">
        <TeamEmojiPicture art={team.art} name={team.name} emoji={emoji} size={32} />
      </span>
      <p>
        You got the <code>:{emoji.name}:</code> team emoji. {teamEmojiUseWords(emoji)}
      </p>
      {!emoji.inSlack && <AddToSlackButton emoji={emoji} emojiPage={emojiPage} />}
    </div>
  );
}
