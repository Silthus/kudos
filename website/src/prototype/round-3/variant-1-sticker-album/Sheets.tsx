// PROTOTYPE (#625, round 3): loose sheets beside the album for the leaderboard, activity and settings. Never merge to main.
import type { ReactNode } from "react";
import type { Album, Moment } from "../album";
import { MemberFace } from "../../art";
import { AppLink } from "../../../AppLink";
import { dateWords, firstNameOf, personHref } from "./model";

function Sheet({ kicker, title, wide = false, children }: { kicker: string; title: string; wide?: boolean; children: ReactNode }) {
  return (
    <article className={`sa-sheet ${wide ? "sa-sheet-wide" : ""}`}>
      <span className="sa-clip" aria-hidden="true" />
      <header className="sa-sheet-head">
        <div>
          <p className="sa-kicker">{kicker}</p>
          <h1>{title}</h1>
        </div>
        <AppLink href="/book" className="sa-sheet-back">
          Back to the album
        </AppLink>
      </header>
      <div className="sa-sheet-body">{children}</div>
    </article>
  );
}

export function LeaderboardSheet({ album }: { album: Album }) {
  return (
    <Sheet kicker="Leaderboard · this week" title="Thoughtful kudos">
      <p className="sa-quiet">Thank-yous that say why, given since Monday.</p>
      <ol className="sa-board">
        {album.board.map((row) => (
          <li key={row.name} className={row.you ? "sa-board-you" : undefined}>
            <span className="sa-board-rank">{row.rank}</span>
            <MemberFace face={row.face} className="sa-board-face" />
            <span className="sa-board-name">{row.you ? `${row.name} (you)` : row.name}</span>
            <span className="sa-board-count">{row.thoughtful}</span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

export function ActivitySheet({ album }: { album: Album }) {
  return (
    <Sheet kicker="Activity" title="Kudos and hugs">
      <ul className="sa-moments">
        {album.moments.map((moment, at) => (
          <li key={`${moment.kind}-${moment.at}-${at}`}>
            <span className="sa-moment-date">{dateWords(moment.at)}</span>
            <MomentLine moment={moment} album={album} />
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function MomentLine({ moment, album }: { moment: Moment; album: Album }) {
  const person = album.people.find(({ key }) => key === moment.person);
  const name = person?.name ?? "A teammate";
  const who = <AppLink href={personHref(moment.person)}>{name}</AppLink>;
  if (moment.kind === "thoughtful-given")
    return (
      <span>
        You thanked {who}: <q>{moment.message}</q> {moment.packed ? <em className="sa-moment-tag">pack earned</em> : <em className="sa-moment-tag sa-moment-tag-quiet">already packed this week</em>}
      </span>
    );
  if (moment.kind === "thoughtful-received")
    return (
      <span>
        {who} thanked you: <q>{moment.message}</q>
      </span>
    );
  if (moment.kind === "hug-given") return <span>You hugged {who}.</span>;
  if (moment.kind === "hug-received") return <span>{who} hugged you.</span>;
  const hoggie = album.hoggies.find(({ hoggie: slug }) => slug === moment.hoggie);
  return (
    <span>
      You opened {firstNameOf(name)}'s pack{moment.newPerson ? `: ${firstNameOf(name)} joined your album` : ""} and found {hoggie?.name ?? "a hoggie"}.
    </span>
  );
}

export function SettingsSheet({ todaysPage }: { todaysPage: ReactNode }) {
  return (
    <Sheet kicker="Settings" title="Your settings" wide>
      <div className="sa-todays">{todaysPage}</div>
    </Sheet>
  );
}
