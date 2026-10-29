// PROTOTYPE (throwaway, branch prototype/leaderboard-never-empty, never merged). Silthus/personal#219.
// Round 2: variant A only (round 1's B and C are in this branch's history), with a positive highlight on the
// "you" card and a "You in <team>" comparison, for a Monday-morning empty week, a quiet week and a lively week.
// Switch states via ?state=empty|quiet|lively on the existing /leaderboard route.
import { useState, type ReactNode } from "react";
import { hedgehogHeartPng } from "@posthog/brand/hoggies/png";
import { AppLink } from "../AppLink";
import { TeamCrest, type TeamArt } from "../crates/TeamCrest";
import { NamedEmoji } from "../Emoji";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import type { Face } from "../shell";
import { SlackLink } from "../SlackLink";
import { hrefOf } from "./place";
import { PrototypeSwitcher, usePrototypeParam, type Choice } from "./PrototypeSwitcher";
import "./leaderboardPrototype.css";

type Way = "hug" | "kudos";
type Who = { person: string; name: string; face: Face };
type Tallies = { hugsGiven: number; hugsReceived: number; kudosReceived: number };
type Member = Who & Tallies & { level: number; hoggies: number; you?: true };
type Team = { team: string; name: string; art: TeamArt; joined: number; of: number; before: number | null; mine?: true };
type Unlock = { emoji: string; picture: string; what: string; how: string; have: number; need: number };
type Step = { way: Way; title: string; why: string; button: string; href: string };
type Me = Member & { xp: number; startsAt: number; nextAt: number; xpThisWeek: number; newHoggies: number; lastWeek: Tallies; bestWeekOfHugs: number; teammatesThanked: number };
type MyTeam = { name: string; teammates: Member[] };
type Situation = { members: Member[]; lastWeek: Member[]; teams: Team[]; me: Me; myTeam: MyTeam; unlocks: Unlock[]; next: Step };
type Measure = { key: "hugsGiven" | "hugsReceived" | "kudosReceived" | "level" | "hoggies"; title: string; tab: string; unit: string; weekly: boolean; firstWays: string };
type Highlight = { headline: string; detail: string };

const slack = "slack://open";

const emoji = "hedgehug";

const variants: Choice[] = [{ key: "A", label: "(You, then the boards) · low use: period switch, Who gave, team fold · known pain: row clicks" }];

const states: Choice[] = [
  { key: "empty", label: "Monday, empty" },
  { key: "quiet", label: "Quiet" },
  { key: "lively", label: "Lively" },
];

const measures: Measure[] = [
  { key: "hugsGiven", title: "Most hugs given", tab: "Hugs given", unit: "hugs", weekly: true, firstWays: "React with :hedgehug: to any message to give the first hug of the week." },
  { key: "hugsReceived", title: "Most hugged", tab: "Hugged", unit: "hugs", weekly: true, firstWays: "Hug a teammate's message and they're the first one here." },
  { key: "kudosReceived", title: "Most kudos received", tab: "Kudos received", unit: "kudos", weekly: true, firstWays: "Write :hedgehug: @name and what they did, and they lead this one." },
  { key: "level", title: "Highest level", tab: "Level", unit: "level", weekly: false, firstWays: "" },
  { key: "hoggies", title: "Most hoggies", tab: "Hoggies", unit: "hoggies", weekly: false, firstWays: "" },
];

function who(person: string, name: string): Who {
  return { person, name, face: { kind: "initials", initials: name.split(" ").map((word) => word.charAt(0)).join("") } };
}

function member(person: Who, hugsGiven: number, hugsReceived: number, kudosReceived: number, level: number, hoggies: number): Member {
  return { ...person, hugsGiven, hugsReceived, kudosReceived, level, hoggies };
}

const wren = who("wren-alder", "Wren Alder");
const ines = who("ines-okafor", "Ines Okafor");
const fen = who("fen-marlowe", "Fen Marlowe");
const juno = who("juno-park", "Juno Park");
const perrin = who("perrin-holt", "Perrin Holt");
const oren = who("oren-pike", "Oren Pike");
const della = who("della-crane", "Della Crane");
const bram = who("bram-teller", "Bram Teller");
const oona = who("oona-vasquez", "Oona Vasquez");
const tomas = who("tomas-reyne", "Tomas Reyne");
const sam = who("sam-example", "Sam Example");

function team(slug: string, name: string, crest: string, joined: number, of: number, before: number | null, mine = false): Team {
  return { team: slug, name, art: { kind: "crest", slug: crest }, joined, of, before, ...(mine ? { mine: true as const } : {}) };
}

const levels = { wren: 9, ines: 7, fen: 6, juno: 4, perrin: 5, oren: 3, della: 2, bram: 3, oona: 5, tomas: 2, sam: 6 };

const hoggies = { wren: 21, ines: 14, fen: 12, juno: 6, perrin: 9, oren: 4, della: 2, bram: 3, oona: 8, tomas: 1, sam: 11 };

const lastWeek: Member[] = [member(wren, 9, 4, 1, levels.wren, hoggies.wren), member(ines, 6, 7, 2, levels.ines, hoggies.ines), member(fen, 4, 5, 3, levels.fen, hoggies.fen), member(perrin, 3, 2, 0, levels.perrin, hoggies.perrin), member(juno, 2, 3, 1, levels.juno, hoggies.juno)];

const levelSix = { xp: 1210, startsAt: 1000, nextAt: 1500 };

const unlocks: Unlock[] = [
  { emoji: "wren-alder-hype", picture: "/emoji/hype.png", what: "Wren's hype emoji", how: "Give Wren a kudos", have: 0, need: 1 },
  { emoji: "team-lanterns", picture: "/emoji/team-workflows.png", what: "Your team emoji", how: "Collect 1 more Lanterns sticker", have: 4, need: 5 },
  { emoji: "level-7", picture: "/emoji/level-5.png", what: "Level 7 emoji", how: "290 XP to go: a hug a day gets you there", have: 210, need: 500 },
];

function lanterns(...teammates: Member[]): MyTeam {
  return { name: "Lanterns", teammates };
}

function zeroWeek(person: Who, level: number, hoggieCount: number) {
  return member(person, 0, 0, 0, level, hoggieCount);
}

const situations: Record<string, Situation> = {
  empty: {
    members: [zeroWeek(ines, levels.ines, hoggies.ines), zeroWeek(wren, levels.wren, hoggies.wren), zeroWeek(fen, levels.fen, hoggies.fen), zeroWeek(perrin, levels.perrin, hoggies.perrin), zeroWeek(juno, levels.juno, hoggies.juno)],
    lastWeek,
    teams: [team("lanterns", "Lanterns", "workflows", 0, 6, null, true), team("kettle-works", "Kettle Works", "experiments", 0, 3, null), team("paper-moons", "Paper Moons", "growth", 0, 4, null), team("quiet-harbour", "Quiet Harbour", "support", 0, 4, null), team("salt-and-sparrow", "Salt and Sparrow", "security", 0, 5, null)],
    me: { ...zeroWeek(sam, levels.sam, hoggies.sam), you: true, ...levelSix, xpThisWeek: 0, newHoggies: 0, lastWeek: { hugsGiven: 6, hugsReceived: 3, kudosReceived: 1 }, bestWeekOfHugs: 6, teammatesThanked: 14 },
    myTeam: lanterns(zeroWeek(ines, levels.ines, hoggies.ines), zeroWeek(juno, levels.juno, hoggies.juno), zeroWeek(bram, levels.bram, hoggies.bram), zeroWeek(oona, levels.oona, hoggies.oona), zeroWeek(tomas, levels.tomas, hoggies.tomas)),
    unlocks,
    next: { way: "hug", title: "Give the first hug of the week", why: "React with :hedgehug: to a teammate's message. The first hug each day pays extra XP, and the first one this week puts you and Lanterns on the board.", button: "Open Slack", href: slack },
  },
  quiet: {
    members: [member(wren, 2, 1, 0, levels.wren, hoggies.wren), member(juno, 1, 1, 0, levels.juno, hoggies.juno), member(ines, 0, 1, 0, levels.ines, hoggies.ines)],
    lastWeek,
    teams: [team("kettle-works", "Kettle Works", "experiments", 1, 3, 0), team("lanterns", "Lanterns", "workflows", 1, 6, 2, true), team("paper-moons", "Paper Moons", "growth", 0, 4, 1), team("quiet-harbour", "Quiet Harbour", "support", 0, 4, 0), team("salt-and-sparrow", "Salt and Sparrow", "security", 0, 5, null)],
    me: { ...member(sam, 0, 1, 0, levels.sam, hoggies.sam), you: true, ...levelSix, xpThisWeek: 10, newHoggies: 0, lastWeek: { hugsGiven: 2, hugsReceived: 1, kudosReceived: 0 }, bestWeekOfHugs: 6, teammatesThanked: 14 },
    myTeam: lanterns(member(juno, 1, 1, 0, levels.juno, hoggies.juno), zeroWeek(ines, levels.ines, hoggies.ines), zeroWeek(bram, levels.bram, hoggies.bram), zeroWeek(oona, levels.oona, hoggies.oona), zeroWeek(tomas, levels.tomas, hoggies.tomas)),
    unlocks,
    next: { way: "hug", title: "Hug Juno's message back", why: "Juno hugged your message on Tuesday. React with :hedgehug: to one of theirs: your first hug each day pays extra XP, and it brings Lanterns to 2 of 6.", button: "Open Slack", href: slack },
  },
  lively: {
    members: [
      member(wren, 11, 6, 2, levels.wren, hoggies.wren),
      member(ines, 8, 9, 3, levels.ines, hoggies.ines),
      member(fen, 6, 4, 1, levels.fen, hoggies.fen),
      member(perrin, 5, 3, 0, levels.perrin, hoggies.perrin),
      member(oren, 3, 2, 1, levels.oren, hoggies.oren),
      member(juno, 2, 5, 2, levels.juno, hoggies.juno),
      member(bram, 1, 0, 0, levels.bram, hoggies.bram),
      member(della, 1, 1, 0, levels.della, hoggies.della),
    ],
    lastWeek,
    teams: [team("quiet-harbour", "Quiet Harbour", "support", 4, 4, 2), team("lanterns", "Lanterns", "workflows", 4, 6, 2, true), team("kettle-works", "Kettle Works", "experiments", 2, 3, 1), team("paper-moons", "Paper Moons", "growth", 2, 4, 2), team("salt-and-sparrow", "Salt and Sparrow", "security", 1, 5, 2)],
    me: { ...member(sam, 4, 2, 1, levels.sam, hoggies.sam), you: true, ...levelSix, xpThisWeek: 180, newHoggies: 2, lastWeek: { hugsGiven: 2, hugsReceived: 1, kudosReceived: 0 }, bestWeekOfHugs: 4, teammatesThanked: 16 },
    myTeam: lanterns(member(ines, 8, 9, 3, levels.ines, hoggies.ines), member(juno, 2, 5, 2, levels.juno, hoggies.juno), member(bram, 1, 0, 0, levels.bram, hoggies.bram), zeroWeek(oona, levels.oona, hoggies.oona), zeroWeek(tomas, levels.tomas, hoggies.tomas)),
    unlocks,
    next: { way: "kudos", title: "Give Wren a kudos", why: "Write :hedgehug: @Wren and what they did. You collect Wren's hype emoji, and kudos are the only way to find epic hoggies.", button: "Open Slack", href: slack },
  },
};

export function LeaderboardPrototype() {
  const [variant, chooseVariant] = usePrototypeParam("variant", variants);
  const [state, chooseState] = usePrototypeParam("state", states);
  const situation = situations[state]!;
  return (
    <>
      <VariantA situation={situation} />
      <PrototypeSwitcher variants={variants} variant={variant} onVariant={chooseVariant} states={states} state={state} onState={chooseState} readout={readoutOf(state, situation)} />
    </>
  );
}

function readoutOf(state: string, { members, teams, me }: Situation) {
  const thanking = members.filter(({ hugsGiven }) => hugsGiven > 0).length;
  const gaining = teams.filter((team) => gainOf(team) > 0).length;
  return `state=${state} · members thanking this week ${thanking} · you gave ${me.hugsGiven} hugs (last week ${me.lastWeek.hugsGiven}), got ${me.hugsReceived} hugs and ${me.kudosReceived} kudos · highlight: ${highlightOf(me).headline} · teams gaining ${gaining}/${teams.length}`;
}

function VariantA({ situation }: { situation: Situation }) {
  const { me, myTeam, next, unlocks: within } = situation;
  const [measureKey, setMeasureKey] = useState<Measure["key"]>("hugsGiven");
  const measure = measures.find(({ key }) => key === measureKey)!;
  return (
    <div className="al-page-body lp-a">
      <p className="al-eyebrow">Leaderboard · this week</p>
      <PageTitle tab="Leaderboard" size="hero">
        Who's thanking who
      </PageTitle>
      <section className="lp-you" aria-label="You this week">
        <div className="lp-you-main">
          <div className="lp-you-who">
            <MemberFace face={me.face} className="lp-face-lg" />
            <div>
              <p className="lp-you-name ph-no-capture">{me.name}</p>
              <LevelBar me={me} />
            </div>
          </div>
          <HighlightLine highlight={highlightOf(me)} />
          <dl className="lp-tallies">
            <Tally figure={me.hugsGiven} before={me.lastWeek.hugsGiven} term="hugs given" />
            <Tally figure={me.hugsReceived} before={me.lastWeek.hugsReceived} term="hugs received" />
            <Tally figure={me.kudosReceived} before={me.lastWeek.kudosReceived} term="kudos received" />
            <Tally figure={me.hoggies} before={me.hoggies - me.newHoggies} term="hoggies" />
          </dl>
        </div>
        <NextStep step={next} />
      </section>
      <div className="lp-a-grid">
        <MeasuredBoard situation={situation} measure={measure} onMeasure={setMeasureKey} />
        <div className="lp-a-side">
          <TeamComparison me={me} myTeam={myTeam} measure={measure} />
          <TeamRace teams={situation.teams} />
        </div>
      </div>
      <WithinReach unlocks={within} />
    </div>
  );
}

function highlightOf(me: Me): Highlight {
  const moreHugs = me.hugsGiven - me.lastWeek.hugsGiven;
  if (moreHugs > 0 && me.hugsGiven >= me.bestWeekOfHugs) return { headline: "Your best week of hugs yet", detail: `${me.hugsGiven} hugs given, ${moreHugs} more than last week · +${me.xpThisWeek} XP · ${me.newHoggies} new hoggies` };
  if (moreHugs > 0) return { headline: `${moreHugs} more hugs than last week`, detail: `+${me.xpThisWeek} XP this week` };
  if (me.hugsReceived + me.kudosReceived > 0) return { headline: `${plural(me.hugsReceived + me.kudosReceived, "teammate")} thanked you this week`, detail: `+${me.xpThisWeek} XP so far · your thanks have reached ${me.teammatesThanked} teammates` };
  if (me.lastWeek.hugsGiven > 0) return { headline: `Last week you gave ${plural(me.lastWeek.hugsGiven, "hug")}`, detail: `${me.lastWeek.hugsGiven >= me.bestWeekOfHugs ? "Your best week yet. " : ""}Your thanks have reached ${me.teammatesThanked} teammates so far.` };
  return { headline: `Your thanks have reached ${me.teammatesThanked} teammates`, detail: "Every hug and kudos you give adds to it." };
}

function HighlightLine({ highlight }: { highlight: Highlight }) {
  return (
    <p className="lp-highlight">
      <span className="lp-highlight-mark" aria-hidden="true">
        ▲
      </span>
      <span>
        <strong>{highlight.headline}</strong>
        <span className="lp-highlight-detail">{highlight.detail}</span>
      </span>
    </p>
  );
}

function MeasuredBoard({ situation: { members, lastWeek: last, me }, measure, onMeasure }: { situation: Situation; measure: Measure; onMeasure: (key: Measure["key"]) => void }) {
  const thisWeek = ranked([...members, me], measure).filter((row) => valueOf(row, measure) > 0 || row.you);
  const quiet = thisWeek.every((row) => row.you && valueOf(row, measure) === 0);
  return (
    <section className="lp-board" aria-label="People">
      <header className="lp-board-head">
        <h2 className="lp-board-title">People</h2>
        <div role="group" aria-label="Rank by" className="lp-measures">
          {measures.map(({ key, tab }) => (
            <button key={key} type="button" aria-pressed={key === measure.key} onClick={() => onMeasure(key)}>
              {tab}
            </button>
          ))}
        </div>
      </header>
      {quiet && measure.weekly ? (
        <>
          <p className="lp-board-fresh">
            <WithEmoji text={`This week starts fresh. ${measure.firstWays}`} />
          </p>
          <p className="lp-board-sub">Last week</p>
          <PeopleRows rows={ranked(last, measure).slice(0, 3)} measure={measure} />
        </>
      ) : (
        <PeopleRows rows={thisWeek} measure={measure} />
      )}
    </section>
  );
}

function TeamComparison({ me, myTeam, measure }: { me: Me; myTeam: MyTeam; measure: Measure }) {
  const everyone = ranked([...myTeam.teammates, me], measure);
  const shown = measure.weekly ? everyone.filter((row) => valueOf(row, measure) > 0 || row.you) : everyone;
  const toStart = everyone.length - shown.length;
  return (
    <section className="lp-board" aria-label={`You in ${myTeam.name}`}>
      <header className="lp-board-head">
        <h2 className="lp-board-title">You in {myTeam.name}</h2>
        <p className="lp-board-deck">{teamStandingWords(me, shown, measure, myTeam.name)}</p>
      </header>
      <PeopleRows rows={shown} measure={measure} />
      {toStart > 0 && <p className="lp-board-deck">{plural(toStart, "more teammate")} can still join in this week.</p>}
    </section>
  );
}

function teamStandingWords(me: Me, rows: Member[], measure: Measure, teamName: string) {
  const mine = valueOf(me, measure);
  if (mine === 0) return rows.length === 1 ? `Nobody in ${teamName} has started yet. Your first hug puts you at the top.` : `Your first hug puts you on ${teamName}'s board.`;
  const rank = rankOf(me, rows, measure);
  if (rank === 1) return `You lead ${teamName} on ${measure.tab.toLowerCase()} this week.`;
  return `You're No. ${rank} of ${rows.length} in ${teamName} on ${measure.tab.toLowerCase()} this week.`;
}

function PeopleRows({ rows, measure }: { rows: Member[]; measure: Measure }) {
  return (
    <ol className="lp-rows">
      {rows.map((row) => (
        <li key={row.person}>
          <AppLink href={hrefOf({ kind: "person", person: row.person })} className="lp-row ph-no-capture" data-you={row.you ? "" : undefined}>
            <span className="lp-rank">{valueOf(row, measure) === 0 ? "–" : rankOf(row, rows, measure)}</span>
            <MemberFace face={row.face} className="lp-face" />
            <span className="lp-row-name">
              {row.name}
              {row.you && <span className="lp-tag">You</span>}
            </span>
            <span className="lp-row-figure">
              {measure.key === "level" ? `Lv ${row.level}` : valueOf(row, measure)}
              {measure.key !== "level" && <small> {valueOf(row, measure) === 1 ? measure.unit.replace(/s$/, "") : measure.unit}</small>}
            </span>
          </AppLink>
        </li>
      ))}
    </ol>
  );
}

function TeamRace({ teams }: { teams: Team[] }) {
  const gaining = teams.filter((team) => gainOf(team) > 0).toSorted((first, second) => gainOf(second) - gainOf(first));
  const everyone = teams.filter(({ joined, of }) => joined === of);
  const starting = teams.filter((team) => !gaining.includes(team));
  return (
    <section className="lp-board" aria-label="Team race">
      <header className="lp-board-head">
        <h2 className="lp-board-title">Teams joining in</h2>
        <p className="lp-board-deck">Teams climb by bringing more teammates in than this time last week.</p>
      </header>
      {everyone.length > 0 && <p className="lp-everyone">Everyone in {everyone.map(({ name }) => name).join(", ")} joined in this week.</p>}
      {gaining.length === 0 ? (
        <p className="lp-board-fresh">No team has started yet. Start your team's week with a hug or a kudos.</p>
      ) : (
        <ol className="lp-rows">
          {gaining.map((team) => (
            <li key={team.team}>
              <TeamLine team={team} rank={1 + gaining.filter((other) => gainOf(other) > gainOf(team)).length} />
            </li>
          ))}
        </ol>
      )}
      {starting.length > 0 && (
        <details className="lp-starting">
          <summary>{starting.length} teams getting started</summary>
          <ul className="lp-rows">
            {starting.map((team) => (
              <li key={team.team}>
                <TeamLine team={team} rank={null} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function TeamLine({ team, rank }: { team: Team; rank: number | null }) {
  const gain = gainOf(team);
  return (
    <AppLink href={hrefOf({ kind: "team", team: team.team })} className="lp-row" data-you={team.mine ? "" : undefined}>
      <span className="lp-rank">{rank ?? "·"}</span>
      <TeamCrest art={team.art} size={28} name={team.name} />
      <span className="lp-row-name">
        {team.name}
        <span className="lp-row-note">
          {team.joined} of {team.of} joined in{team.mine ? " · your team" : ""}
        </span>
      </span>
      <Share joined={team.joined} of={team.of} />
      {gain > 0 && <span className="lp-gain">+{gain} pts</span>}
    </AppLink>
  );
}

function NextStep({ step }: { step: Step }) {
  return (
    <div className="lp-next">
      <WayChip way={step.way} />
      <p className="lp-next-title">{step.title}</p>
      <p className="lp-next-why">
        <WithEmoji text={step.why} />
      </p>
      <SlackLink chatUrl={step.href} variant="primary" size="default">
        {step.button}
      </SlackLink>
    </div>
  );
}

function WithinReach({ unlocks: within }: { unlocks: Unlock[] }) {
  return (
    <section className="lp-reach" aria-label="Emojis within reach">
      <h2 className="lp-board-title">Emojis within your reach</h2>
      <ul className="lp-unlocks">
        {within.map((unlock) => (
          <li key={unlock.emoji} className="lp-unlock">
            <img src={unlock.picture} alt="" width={32} height={32} className="lp-unlock-picture" />
            <span className="lp-unlock-words">
              <span className="lp-unlock-what">
                {unlock.what} <code>:{unlock.emoji}:</code>
              </span>
              <span className="lp-row-note">{unlock.how}</span>
              {unlock.need > 1 && <Share joined={unlock.have} of={unlock.need} />}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LevelBar({ me }: { me: Me }) {
  return (
    <div className="lp-level">
      <span className="lp-level-label">
        Level {me.level} · {me.nextAt - me.xp} XP to level {me.level + 1}
      </span>
      <Share joined={me.xp - me.startsAt} of={me.nextAt - me.startsAt} />
    </div>
  );
}

function Share({ joined, of }: { joined: number; of: number }) {
  return (
    <span className="lp-share" aria-hidden="true">
      <span className="lp-share-fill" style={{ width: `${Math.max(3, (joined / of) * 100)}%` }} />
    </span>
  );
}

function Tally({ figure, before, term }: { figure: number; before: number; term: string }) {
  return (
    <div className="lp-tally">
      <dd>
        {figure}
        {figure > before && <span className="lp-tally-up">+{figure - before}</span>}
      </dd>
      <dt>{term}</dt>
    </div>
  );
}

function WayChip({ way }: { way: Way }) {
  return (
    <span className="lp-way" data-way={way}>
      {way === "hug" ? "Hug · a reaction" : "Kudos · a message"}
    </span>
  );
}

function WithEmoji({ text }: { text: string }): ReactNode {
  return text.split(`:${emoji}:`).flatMap((part, index) => (index === 0 ? [part] : [<NamedEmoji key={index} name={emoji} image={hedgehogHeartPng} />, part]));
}

function plural(count: number, word: string) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

function valueOf(row: Member, { key }: Measure) {
  return row[key];
}

function ranked(rows: Member[], measure: Measure) {
  return rows.toSorted((first, second) => valueOf(second, measure) - valueOf(first, measure));
}

function rankOf(row: Member, rows: Member[], measure: Measure) {
  return 1 + rows.filter((other) => valueOf(other, measure) > valueOf(row, measure)).length;
}

function gainOf({ joined, of, before }: Team) {
  if (before === null) return 0;
  return Math.round(((joined - before) / of) * 100);
}
