import { useEffect, useRef } from "react";
import type { Highlight, HugBoards, Tallies } from "../../../convex/website/leaderboard";
import type { AlbumLevel, AlbumMe, HugBoardsShown } from "../album/answer";
import { levelShareOf, plural, xpToNextOf } from "../album/facts";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import { AnswerPage } from "../pages/AnswerPage";
import { LoadingPage } from "../pages/LoadingPage";
import "./leaderboard.css";

type ThisWeekAnswerProps = { shown: HugBoardsShown | undefined; me: AlbumMe; level: AlbumLevel; onViewed: () => void; onSignIn: () => void; onSignOut: () => void };

type Words = { headline: string; detail: string };

const tallyTerms: Record<keyof Tallies, string> = { hugsGiven: "hugs given", hugsReceived: "hugs received", kudosReceived: "kudos received", hoggiesFound: "hoggies found" };

export function ThisWeekAnswerPage({ shown, me, level, onViewed, ...answers }: ThisWeekAnswerProps) {
  if (isWaitingForTheWeeksBoards(shown)) return <LoadingPage shape="column" />;
  if (shown.kind !== "boards") return <AnswerPage answer={shown} {...answers} />;
  return <ThisWeekPage boards={shown} me={me} level={level} onViewed={onViewed} />;
}

export function isWaitingForTheWeeksBoards(shown: HugBoardsShown | undefined): shown is undefined | { kind: "off" } {
  return shown === undefined || shown.kind === "off";
}

function ThisWeekPage({ boards, me, level, onViewed }: { boards: HugBoards; me: AlbumMe; level: AlbumLevel; onViewed: () => void }) {
  useViewedOnce(onViewed);
  return (
    <div className="al-page-body lb-week">
      <p className="al-eyebrow">Leaderboard · this week</p>
      <PageTitle tab="Leaderboard" size="hero">
        Who's thanking who
      </PageTitle>
      <YouCard boards={boards} me={me} level={level} />
    </div>
  );
}

function useViewedOnce(onViewed: () => void) {
  const viewed = useRef(false);
  const latest = useRef(onViewed);
  latest.current = onViewed;
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    latest.current();
  }, []);
}

function YouCard({ boards: { you }, me, level }: { boards: HugBoards; me: AlbumMe; level: AlbumLevel }) {
  return (
    <section className="lb-you" aria-label="You this week">
      <div className="lb-you-who">
        <MemberFace face={me.face} className="lb-face-lg" />
        <div>
          <p className="lb-you-name ph-no-capture">{me.name}</p>
          <LevelBar level={level} />
        </div>
      </div>
      <HighlightLine words={wordsOf(you.highlight)} />
      <dl className="lb-tallies">
        {(Object.keys(tallyTerms) as Array<keyof Tallies>).map((tally) => (
          <Tally key={tally} figure={you.tallies[tally]} before={you.lastWeek[tally]} term={tallyTerms[tally]} />
        ))}
      </dl>
    </section>
  );
}

function LevelBar({ level }: { level: AlbumLevel }) {
  return (
    <div className="lb-level">
      <span className="lb-level-label">
        Level {level.level} · {xpToNextOf(level)} XP to level {level.level + 1}
      </span>
      <span className="lb-share" aria-hidden="true">
        <span className="lb-share-fill" style={{ width: `${Math.max(3, levelShareOf(level) * 100)}%` }} />
      </span>
    </div>
  );
}

function HighlightLine({ words }: { words: Words }) {
  return (
    <p className="lb-highlight">
      <span className="lb-highlight-mark" aria-hidden="true">
        ▲
      </span>
      <span>
        <strong>{words.headline}</strong>
        <span className="lb-highlight-detail">{words.detail}</span>
      </span>
    </p>
  );
}

function Tally({ figure, before, term }: { figure: number; before: number; term: string }) {
  return (
    <div className="lb-tally">
      <dt>{term}</dt>
      <dd>
        {figure}
        {figure > before && <span className="lb-tally-up">+{figure - before}</span>}
      </dd>
    </div>
  );
}

function wordsOf(highlight: Highlight): Words {
  switch (highlight.kind) {
    case "best-week":
      return { headline: "Your best week of hugs yet", detail: [`${plural(highlight.hugsGiven, "hug", "hugs")} given, ${highlight.more} more than last week`, ...(highlight.hoggiesFound > 0 ? [plural(highlight.hoggiesFound, "new hoggie", "new hoggies")] : [])].join(" · ") };
    case "more-hugs":
      return { headline: `${plural(highlight.more, "more hug", "more hugs")} than last week`, detail: `${plural(highlight.hugsGiven, "hug", "hugs")} given this week` };
    case "thanked":
      return { headline: `${plural(highlight.teammates, "teammate", "teammates")} thanked you this week`, detail: `Your thanks have reached ${plural(highlight.reach, "teammate", "teammates")}` };
    case "last-week":
      return { headline: `Last week you gave ${plural(highlight.hugs, "hug", "hugs")}`, detail: `${highlight.best ? "Your best week yet. " : ""}Your thanks have reached ${plural(highlight.reach, "teammate", "teammates")} so far.` };
    case "reach":
      return { headline: `Your thanks have reached ${plural(highlight.teammates, "teammate", "teammates")}`, detail: "Every hug and kudos you give adds to it." };
  }
}

