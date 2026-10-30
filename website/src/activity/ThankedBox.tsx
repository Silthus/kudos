import type { ReactNode } from "react";
import type { Thanks } from "../../../convex/website/activity";
import { MemberFace } from "../Face";
import { KudosMessage } from "./KudosMessage";

const wayWords: Record<Thanks["way"], string> = {
  "hugged-your-message": "hugged your message",
  "hugged-your-kudos-back": "hugged your kudos back",
  "hugged-a-kudos-you-got": "hugged a kudos you got",
  "gave-you-a-kudos": "gave you a kudos",
};

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

export function ThankedBox({ thanked }: { thanked: Thanks[] }) {
  return (
    <section className="al-week-box" aria-label="Who thanked you this week">
      <h2 className="al-week-box-title">Who thanked you this week</h2>
      {thanked.length === 0 ? (
        <p className="al-week-box-quiet">Nobody yet. Hugs and kudos you get show here, with who sent them.</p>
      ) : (
        <ul className="al-thanked">
          {thanked.map((thanks) => (
            <ThanksRow key={`${thanks.from.person}:${thanks.at}:${thanks.way}`} thanks={thanks} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ThanksRow({ thanks }: { thanks: Thanks }) {
  return (
    <li className="al-thanks ph-no-capture">
      <MemberFace face={thanks.from.face} className="al-thanks-face" />
      <div className="al-thanks-words">
        <p className="al-thanks-who">
          {thanks.from.name} <span className="al-thanks-way">{wayOf(thanks)} · {weekday.format(thanks.at)}</span>
        </p>
        {"words" in thanks && thanks.words !== null && <KudosMessage message={thanks.words} />}
      </div>
    </li>
  );
}

function wayOf(thanks: Thanks): ReactNode {
  const words = wayWords[thanks.way];
  if (!("permalink" in thanks) || thanks.permalink === null) return words;
  return (
    <a href={thanks.permalink} target="_blank" rel="noreferrer" className="al-thanks-link">
      {words} <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
