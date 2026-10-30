import type { ReactNode } from "react";
import type { LoopLesson } from "../../../convex/album/items/welcome";
import type { HugBoards, HugMeasure, PersonRow } from "../../../convex/website/leaderboard";
import type { TeamBoard as Team } from "../../../convex/website/peopleBoards";
import { plural } from "../album/facts";
import { hrefOf } from "../album/place";
import { AppLink } from "../AppLink";
import { NamedEmoji } from "../Emoji";
import { MemberFace } from "../Face";

type Measure = { measure: HugMeasure; tab: string; unit: [one: string, many: string] | null; firstWays: ((emoji: ReactNode) => ReactNode) | null };

const measures: Measure[] = [
  { measure: "hugsGiven", tab: "Hugs given", unit: ["hug", "hugs"], firstWays: (emoji) => <>React with {emoji} to any message to give the first hug of the week.</> },
  { measure: "hugsReceived", tab: "Hugged", unit: ["hug", "hugs"], firstWays: () => "Hug a teammate's message and they're the first one here." },
  { measure: "kudosReceived", tab: "Kudos received", unit: ["kudos", "kudos"], firstWays: (emoji) => <>Write {emoji} @name and what they did, and they lead this one.</> },
  { measure: "level", tab: "Level", unit: null, firstWays: null },
  { measure: "hoggies", tab: "Hoggies", unit: ["hoggie", "hoggies"], firstWays: null },
];

export type MeasureChoice = { chosen: HugMeasure; choose: (measure: HugMeasure) => void };

export function PeopleBoard({ boards, choice }: { boards: HugBoards; choice: MeasureChoice }) {
  const measure = measureOf(boards.measure);
  const { rows, lastWeek } = boards.people;
  return (
    <section className="lb-board" aria-label="People">
      <header className="lb-board-head">
        <h2 className="lb-board-title">People</h2>
        <MeasureChips choice={choice} />
      </header>
      {lastWeek === null ? (
        <PersonRows rows={rows} measure={measure} />
      ) : (
        <>
          <p className="lb-board-fresh">
            This week starts fresh. {measure.firstWays?.(<KudosEmoji lesson={boards.kudosEmoji} />)}
          </p>
          <p className="lb-board-sub">Last week</p>
          <PersonRows rows={lastWeek} measure={measure} />
        </>
      )}
    </section>
  );
}

function MeasureChips({ choice: { chosen, choose } }: { choice: MeasureChoice }) {
  return (
    <div role="group" aria-label="Rank by" className="lb-measures">
      {measures.map(({ measure, tab }) => (
        <button key={measure} type="button" aria-pressed={measure === chosen} onClick={() => choose(measure)}>
          {tab}
        </button>
      ))}
    </div>
  );
}

export function TeamBoard({ team, measure: chosen }: { team: Team; measure: HugMeasure }) {
  const measure = measureOf(chosen);
  return (
    <section className="lb-board" aria-label={`You in ${team.name}`}>
      <header className="lb-board-head">
        <h2 className="lb-board-title">You in {team.name}</h2>
        <p className="lb-board-deck">{teamStandingWords(team, measure)}</p>
      </header>
      <PersonRows rows={team.rows} measure={measure} />
      {team.yetToJoin > 0 && <p className="lb-board-deck">{plural(team.yetToJoin, "more teammate", "more teammates")} can still join in this week.</p>}
    </section>
  );
}

function teamStandingWords({ name, rows }: Team, { tab }: Measure): string {
  const rank = rows.find(({ you }) => you)?.rank ?? null;
  if (rank === null) return rows.some(({ you }) => !you) ? `Your first hug puts you on ${name}'s board.` : `Nobody in ${name} has started yet. Your first hug puts you at the top.`;
  if (rank === 1) return `You lead ${name} on ${tab.toLowerCase()} this week.`;
  return `You're No. ${rank} of ${rows.length} in ${name} on ${tab.toLowerCase()} this week.`;
}

function PersonRows({ rows, measure }: { rows: PersonRow[]; measure: Measure }) {
  return (
    <ol className="lb-rows">
      {rows.map((row) => (
        <li key={row.person}>
          <AppLink href={hrefOf({ kind: "person", person: row.person })} className="lb-row ph-no-capture" data-you={row.you ? "" : undefined}>
            <span className="lb-rank">{row.rank ?? "–"}</span>
            <MemberFace face={row.face} className="lb-face" />
            <span className="lb-row-name">
              {row.name}
              {row.you && <span className="lb-tag">You</span>}
            </span>
            <Figure figure={row.figure} unit={measure.unit} />
          </AppLink>
        </li>
      ))}
    </ol>
  );
}

function Figure({ figure, unit }: { figure: number; unit: Measure["unit"] }) {
  if (unit === null) return <span className="lb-row-figure">Lv {figure}</span>;
  return (
    <span className="lb-row-figure">
      {figure}
      <small> {figure === 1 ? unit[0] : unit[1]}</small>
    </span>
  );
}

function KudosEmoji({ lesson: { kudosEmoji, kudosEmojiImage } }: { lesson: LoopLesson }) {
  return <NamedEmoji name={kudosEmoji} image={kudosEmojiImage ?? undefined} />;
}

function measureOf(measure: HugMeasure): Measure {
  return measures.find((each) => each.measure === measure)!;
}
