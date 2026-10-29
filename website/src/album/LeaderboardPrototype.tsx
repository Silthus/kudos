// PROTOTYPE (throwaway, branch prototype/leaderboard-never-empty, never merged). Silthus/personal#219.
// Round 1: three variants of the Leaderboard for a Monday-morning empty week, a quiet week and a lively week,
// switchable via ?variant=A|B|C and ?state=empty|quiet|lively on the existing /leaderboard route.
import { useState, type ReactNode } from "react";
import { hedgehogHeartPng } from "@posthog/brand/hoggies/png";
import { AppLink } from "../AppLink";
import { TeamCrest, type TeamArt } from "../crates/TeamCrest";
import { NamedEmoji } from "../Emoji";
import { MemberFace } from "../Face";
import { HedgehogStar } from "../hoggies";
import { PageTitle } from "../PageTitle";
import type { Face } from "../shell";
import { SlackLink } from "../SlackLink";
import { hrefOf } from "./place";
import { PrototypeSwitcher, usePrototypeParam, type Choice } from "./PrototypeSwitcher";
import "./leaderboardPrototype.css";

type Way = "hug" | "kudos";
type Who = { person: string; name: string; face: Face };
type Member = Who & { hugsGiven: number; hugsReceived: number; kudosReceived: number; level: number; hoggies: number; you?: true };
type Team = { team: string; name: string; art: TeamArt; joined: number; of: number; before: number | null; mine?: true };
type Unlock = { emoji: string; picture: string; what: string; how: string; have: number; need: number };
type Step = { way: Way; title: string; why: string; button: string; href: string };
type Me = Member & { xp: number; startsAt: number; nextAt: number };
type Situation = { members: Member[]; lastWeek: Member[]; teams: Team[]; me: Me; unlocks: Unlock[]; next: Step; rally: Step };
type Measure = { key: "hugsGiven" | "hugsReceived" | "kudosReceived" | "level" | "hoggies"; title: string; unit: string; firstWays: string };

const slack = "slack://open";

const emoji = "hedgehug";

const variants: Choice[] = [
  { key: "A", label: "(You, then the boards)" },
  { key: "B", label: "(Awards wall)" },
  { key: "C", label: "(Team race)" },
];

const states: Choice[] = [
  { key: "empty", label: "Monday, empty" },
  { key: "quiet", label: "Quiet" },
  { key: "lively", label: "Lively" },
];

const measures: Measure[] = [
  { key: "hugsGiven", title: "Most hugs given", unit: "hugs", firstWays: "React with :hedgehug: to any message to give the first hug of the week." },
  { key: "hugsReceived", title: "Most hugged", unit: "hugs", firstWays: "Hug a teammate's message and they're the first one here." },
  { key: "kudosReceived", title: "Most kudos received", unit: "kudos", firstWays: "Write :hedgehug: @name and what they did, and they lead this one." },
  { key: "level", title: "Highest level", unit: "level", firstWays: "" },
  { key: "hoggies", title: "Most hoggies", unit: "hoggies", firstWays: "" },
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
const sam = who("sam-example", "Sam Example");

function team(slug: string, name: string, crest: string, joined: number, of: number, before: number | null, mine = false): Team {
  return { team: slug, name, art: { kind: "crest", slug: crest }, joined, of, before, ...(mine ? { mine: true as const } : {}) };
}

const levels = { wren: 9, ines: 7, fen: 6, juno: 4, perrin: 5, oren: 3, della: 2, sam: 6 };

const hoggies = { wren: 21, ines: 14, fen: 12, juno: 6, perrin: 9, oren: 4, della: 2, sam: 11 };

const lastWeek: Member[] = [member(wren, 9, 4, 1, levels.wren, hoggies.wren), member(ines, 6, 7, 2, levels.ines, hoggies.ines), member(fen, 4, 5, 3, levels.fen, hoggies.fen), member(perrin, 3, 2, 0, levels.perrin, hoggies.perrin), member(juno, 2, 3, 1, levels.juno, hoggies.juno)];

const levelSix = { xp: 1210, startsAt: 1000, nextAt: 1500 };

const unlocks: Unlock[] = [
  { emoji: "wren-alder-hype", picture: "/emoji/hype.png", what: "Wren's hype emoji", how: "Give Wren a kudos", have: 0, need: 1 },
  { emoji: "team-lanterns", picture: "/emoji/team-workflows.png", what: "Your team emoji", how: "Collect 1 more Lanterns sticker", have: 4, need: 5 },
  { emoji: "level-7", picture: "/emoji/level-5.png", what: "Level 7 emoji", how: "290 XP to go: a hug a day gets you there", have: 210, need: 500 },
];

const giveWrenAKudos: Step = { way: "kudos", title: "Give Wren a kudos", why: "Write :hedgehug: @Wren and what they did. You collect Wren's hype emoji, and kudos are the only way to find epic hoggies.", button: "Open Slack", href: slack };

const situations: Record<string, Situation> = {
  empty: {
    members: [member(ines, 0, 0, 0, levels.ines, hoggies.ines), member(wren, 0, 0, 0, levels.wren, hoggies.wren), member(fen, 0, 0, 0, levels.fen, hoggies.fen), member(perrin, 0, 0, 0, levels.perrin, hoggies.perrin), member(juno, 0, 0, 0, levels.juno, hoggies.juno)],
    lastWeek,
    teams: [team("lanterns", "Lanterns", "workflows", 0, 6, null, true), team("kettle-works", "Kettle Works", "experiments", 0, 3, null), team("paper-moons", "Paper Moons", "growth", 0, 4, null), team("quiet-harbour", "Quiet Harbour", "support", 0, 4, null), team("salt-and-sparrow", "Salt and Sparrow", "security", 0, 5, null)],
    me: { ...member(sam, 0, 0, 0, levels.sam, hoggies.sam), you: true, ...levelSix },
    unlocks,
    next: { way: "hug", title: "Give the first hug of the week", why: "React with :hedgehug: to a teammate's message. The first hug each day pays extra XP, and the first one this week puts you and Lanterns on the board.", button: "Open Slack", href: slack },
    rally: { way: "hug", title: "Start Lanterns' week", why: "Nobody's on the board yet. Your hug puts Lanterns in the race.", button: "Open Slack", href: slack },
  },
  quiet: {
    members: [member(wren, 2, 1, 0, levels.wren, hoggies.wren), member(juno, 1, 1, 0, levels.juno, hoggies.juno), member(ines, 0, 1, 0, levels.ines, hoggies.ines)],
    lastWeek,
    teams: [team("kettle-works", "Kettle Works", "experiments", 1, 3, 0), team("lanterns", "Lanterns", "workflows", 1, 6, 2, true), team("paper-moons", "Paper Moons", "growth", 0, 4, 1), team("quiet-harbour", "Quiet Harbour", "support", 0, 4, 0), team("salt-and-sparrow", "Salt and Sparrow", "security", 0, 5, null)],
    me: { ...member(sam, 0, 0, 0, levels.sam, hoggies.sam), you: true, ...levelSix },
    unlocks,
    next: { way: "hug", title: "Hug a message today", why: "React with :hedgehug: to a teammate's message. Your first hug each day pays extra XP, and it brings Lanterns to 2 of 6.", button: "Open Slack", href: slack },
    rally: { way: "hug", title: "Join in for Lanterns", why: "1 of 6 Lanterns joined in so far. Your hug makes it 2.", button: "Open Slack", href: slack },
  },
  lively: {
    members: [
      member(wren, 11, 6, 2, levels.wren, hoggies.wren),
      member(ines, 8, 9, 3, levels.ines, hoggies.ines),
      member(fen, 6, 4, 1, levels.fen, hoggies.fen),
      member(perrin, 5, 3, 0, levels.perrin, hoggies.perrin),
      member(oren, 3, 2, 1, levels.oren, hoggies.oren),
      member(juno, 2, 5, 2, levels.juno, hoggies.juno),
      member(della, 1, 1, 0, levels.della, hoggies.della),
    ],
    lastWeek,
    teams: [team("quiet-harbour", "Quiet Harbour", "support", 4, 4, 2), team("lanterns", "Lanterns", "workflows", 4, 6, 2, true), team("kettle-works", "Kettle Works", "experiments", 2, 3, 1), team("paper-moons", "Paper Moons", "growth", 2, 4, 2), team("salt-and-sparrow", "Salt and Sparrow", "security", 1, 5, 2)],
    me: { ...member(sam, 4, 2, 1, levels.sam, hoggies.sam), you: true, ...levelSix },
    unlocks,
    next: giveWrenAKudos,
    rally: { way: "kudos", title: "Bring Lanterns to everyone", why: "4 of 6 Lanterns joined in this week. Post the race in #lanterns: a nudge from a teammate brings the last two in.", button: "Rally Lanterns in Slack", href: slack },
  },
};

export function LeaderboardPrototype() {
  const [variant, chooseVariant] = usePrototypeParam("variant", variants);
  const [state, chooseState] = usePrototypeParam("state", states);
  const situation = situations[state]!;
  return (
    <>
      {variant === "A" && <VariantA situation={situation} />}
      {variant === "B" && <VariantB situation={situation} />}
      {variant === "C" && <VariantC situation={situation} />}
      <PrototypeSwitcher variants={variants} variant={variant} onVariant={chooseVariant} states={states} state={state} onState={chooseState} readout={readoutOf(state, situation)} />
    </>
  );
}

function readoutOf(state: string, { members, teams, me, next }: Situation) {
  const thanking = members.filter(({ hugsGiven }) => hugsGiven > 0).length;
  const gaining = teams.filter((team) => gainOf(team) > 0).length;
  return `state=${state} · members thanking this week ${thanking} · you gave ${me.hugsGiven} hugs, got ${me.hugsReceived} hugs and ${me.kudosReceived} kudos · teams gaining ${gaining}/${teams.length} · next: ${next.way}`;
}

function VariantA({ situation }: { situation: Situation }) {
  const { me, next, unlocks: within } = situation;
  return (
    <div className="al-page-body lp-a">
      <p className="al-eyebrow">Leaderboard · this week</p>
      <PageTitle tab="Leaderboard" size="hero">
        Who's thanking who
      </PageTitle>
      <section className="lp-you" aria-label="You this week">
        <div className="lp-you-who">
          <MemberFace face={me.face} className="lp-face-lg" />
          <div>
            <p className="lp-you-name ph-no-capture">{me.name}</p>
            <LevelBar me={me} />
          </div>
        </div>
        <dl className="lp-tallies">
          <Tally figure={me.hugsGiven} term="hugs given" />
          <Tally figure={me.hugsReceived} term="hugs received" />
          <Tally figure={me.kudosReceived} term="kudos received" />
          <Tally figure={me.hoggies} term="hoggies" />
        </dl>
        <NextStep step={next} />
      </section>
      <div className="lp-a-grid">
        <MeasuredBoard situation={situation} />
        <TeamRace teams={situation.teams} />
      </div>
      <WithinReach unlocks={within} />
    </div>
  );
}

function MeasuredBoard({ situation: { members, lastWeek: last, me } }: { situation: Situation }) {
  const [measureKey, setMeasureKey] = useState<Measure["key"]>("hugsGiven");
  const measure = measures.find(({ key }) => key === measureKey)!;
  const thisWeek = ranked([...members, me], measure).filter((row) => valueOf(row, measure) > 0 || row.you);
  const quiet = thisWeek.every((row) => row.you && valueOf(row, measure) === 0);
  return (
    <section className="lp-board" aria-label="People">
      <header className="lp-board-head">
        <h2 className="lp-board-title">People</h2>
        <div role="group" aria-label="Rank by" className="lp-measures">
          {measures.map(({ key, title }) => (
            <button key={key} type="button" aria-pressed={key === measureKey} onClick={() => setMeasureKey(key)}>
              {title.replace("Most ", "").replace("Highest ", "").replace(/^./, (first) => first.toUpperCase())}
            </button>
          ))}
        </div>
      </header>
      {quiet && measure.firstWays !== "" ? (
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

function PeopleRows({ rows, measure }: { rows: Member[]; measure: Measure }) {
  return (
    <ol className="lp-rows">
      {rows.map((row) => (
        <li key={row.person}>
          <AppLink href={hrefOf({ kind: "person", person: row.person })} className="lp-row ph-no-capture" data-you={row.you ? "" : undefined}>
            <span className="lp-rank">{valueOf(row, measure) === 0 ? "–" : 1 + rows.filter((other) => valueOf(other, measure) > valueOf(row, measure)).length}</span>
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
  const starting = teams.filter((team) => !gaining.includes(team) && !everyone.includes(team));
  return (
    <section className="lp-board" aria-label="Team race">
      <header className="lp-board-head">
        <h2 className="lp-board-title">Teams joining in</h2>
        <p className="lp-board-deck">Teams climb by bringing more teammates in than this time last week.</p>
      </header>
      {everyone.length > 0 && (
        <p className="lp-everyone">
          {everyone.map(({ name }) => name).join(", ")}: everyone joined in this week 💜
        </p>
      )}
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
        {team.mine && <span className="lp-tag">Your team</span>}
        <span className="lp-row-note">
          {team.joined} of {team.of} joined in
        </span>
      </span>
      <Share joined={team.joined} of={team.of} />
      {gain > 0 && <span className="lp-gain">+{gain} pts</span>}
    </AppLink>
  );
}

function VariantB({ situation }: { situation: Situation }) {
  const { members, lastWeek: last, me, teams, next, unlocks: within } = situation;
  const everyone = [...members, me];
  const gaining = teams.filter((team) => gainOf(team) > 0).toSorted((first, second) => gainOf(second) - gainOf(first));
  const full = teams.filter(({ joined, of }) => joined === of);
  return (
    <div className="al-page-body lp-b">
      <div className="lp-b-head">
        <div>
          <p className="al-eyebrow">Leaderboard · this week's awards</p>
          <PageTitle tab="Leaderboard" size="hero">
            The thank-you awards
          </PageTitle>
        </div>
      </div>
      <section className="lp-b-move" aria-label="Your move">
        <WayChip way={next.way} />
        <p className="lp-b-move-words">
          <strong>{next.title}.</strong> <WithEmoji text={next.why} />
        </p>
        <SlackLink chatUrl={next.href} variant="primary" size="default">
          {next.button}
        </SlackLink>
      </section>
      <div className="lp-b-wall">
        {measures.map((measure) => (
          <Award key={measure.key} measure={measure} rows={everyone} last={last} me={me} />
        ))}
        <section className="lp-award" aria-label="Most improved teams">
          <h2 className="lp-award-title">Most improved teams</h2>
          {gaining.length === 0 ? (
            <p className="lp-award-empty">No team has started yet. The first team to bring a teammate in takes this one.</p>
          ) : (
            <ol className="lp-award-rows">
              {gaining.slice(0, 3).map((team) => (
                <li key={team.team}>
                  <AppLink href={hrefOf({ kind: "team", team: team.team })} className="lp-award-row" data-you={team.mine ? "" : undefined}>
                    <span className="lp-medal" data-place={1 + gaining.filter((other) => gainOf(other) > gainOf(team)).length} />
                    <TeamCrest art={team.art} size={24} name={team.name} />
                    <span className="lp-row-name">{team.name}</span>
                    <span className="lp-gain">+{gainOf(team)} pts</span>
                  </AppLink>
                </li>
              ))}
            </ol>
          )}
          <MineTeamLine teams={teams} />
        </section>
        <section className="lp-award" aria-label="Everyone joined in">
          <h2 className="lp-award-title">Everyone joined in 💜</h2>
          {full.length === 0 ? (
            <p className="lp-award-empty">No team yet. A team gets its heart when every teammate gives a hug or a kudos this week.</p>
          ) : (
            <ul className="lp-award-rows">
              {full.map((team) => (
                <li key={team.team} className="lp-award-row">
                  <TeamCrest art={team.art} size={24} name={team.name} />
                  <span className="lp-row-name">{team.name}</span>
                  <span className="lp-row-note">
                    {team.of} of {team.of}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="lp-award lp-award-wide" aria-label="Emojis within reach">
          <h2 className="lp-award-title">Emojis within your reach</h2>
          <UnlockList unlocks={within} />
        </section>
      </div>
    </div>
  );
}

function Award({ measure, rows, last, me }: { measure: Measure; rows: Member[]; last: Member[]; me: Me }) {
  const top = ranked(rows, measure)
    .filter((row) => valueOf(row, measure) > 0)
    .slice(0, 3);
  const mineInTop = top.some(({ you }) => you);
  const lastLeader = ranked(last, measure)[0]!;
  return (
    <section className="lp-award" aria-label={measure.title}>
      <h2 className="lp-award-title">{measure.title}</h2>
      {top.length === 0 ? (
        <>
          <p className="lp-award-empty">
            <WithEmoji text={`Nobody yet this week. ${measure.firstWays}`} />
          </p>
          <p className="lp-award-last ph-no-capture">
            Last week: {lastLeader.name}, {valueOf(lastLeader, measure)} {measure.unit}
          </p>
        </>
      ) : (
        <ol className="lp-award-rows">
          {top.map((row) => (
            <li key={row.person}>
              <AppLink href={hrefOf({ kind: "person", person: row.person })} className="lp-award-row ph-no-capture" data-you={row.you ? "" : undefined}>
                <span className="lp-medal" data-place={1 + top.filter((other) => valueOf(other, measure) > valueOf(row, measure)).length} />
                <MemberFace face={row.face} className="lp-face" />
                <span className="lp-row-name">{row.name}</span>
                <span className="lp-row-figure">{measure.key === "level" ? `Lv ${row.level}` : valueOf(row, measure)}</span>
              </AppLink>
            </li>
          ))}
        </ol>
      )}
      {!mineInTop && top.length > 0 && <p className="lp-award-you">You: {measure.key === "level" ? `level ${me.level}` : `${valueOf(me, measure)} ${measure.unit}`}</p>}
    </section>
  );
}

function MineTeamLine({ teams }: { teams: Team[] }) {
  const mine = teams.find((team) => team.mine);
  if (mine === undefined) return null;
  return (
    <p className="lp-award-you">
      Lanterns: {mine.joined} of {mine.of} joined in{gainOf(mine) > 0 ? `, up ${gainOf(mine)} pts` : ""}
    </p>
  );
}

function VariantC({ situation }: { situation: Situation }) {
  const { members, me, teams, rally, unlocks: within } = situation;
  const mine = teams.find((team) => team.mine)!;
  const others = teams.filter((team) => !team.mine).toSorted((first, second) => gainOf(second) - gainOf(first) || second.joined / second.of - first.joined / first.of);
  const everyone = [...members, me];
  return (
    <div className="al-page-body lp-c">
      <p className="al-eyebrow">Leaderboard · team race this week</p>
      <PageTitle tab="Leaderboard" size="hero">
        Every teammate counts
      </PageTitle>
      <section className="lp-c-mine" aria-label="Your team">
        <div className="lp-c-mine-head">
          <TeamCrest art={mine.art} size={56} name={mine.name} />
          <div>
            <h2 className="lp-c-mine-name">{mine.name}</h2>
            <p className="lp-c-mine-note">
              {mine.joined} of {mine.of} joined in{gainOf(mine) > 0 ? ` · up ${gainOf(mine)} pts from this time last week` : ""}
            </p>
          </div>
          <SlackLink chatUrl={rally.href} variant="primary" size="lg">
            {rally.button}
          </SlackLink>
        </div>
        <Lane team={mine} />
        <p className="lp-c-rally">
          <strong>{rally.title}.</strong> <WithEmoji text={rally.why} />
        </p>
      </section>
      <section className="lp-c-lanes" aria-label="The race">
        <header className="lp-c-lanes-head">
          <h2 className="lp-board-title">The race</h2>
          <p className="lp-board-deck">Each hedgehog runs as far as its team's share of teammates who joined in. The finish line is everyone.</p>
        </header>
        <ol className="lp-c-lane-list">
          {others.map((team) => (
            <li key={team.team}>
              <AppLink href={hrefOf({ kind: "team", team: team.team })} className="lp-c-lane-row">
                <TeamCrest art={team.art} size={28} name={team.name} />
                <span className="lp-c-lane-name">
                  {team.name}
                  <span className="lp-row-note">
                    {team.joined} of {team.of}
                    {team.joined === team.of ? " · everyone 💜" : ""}
                  </span>
                </span>
                <Lane team={team} />
                {gainOf(team) > 0 ? <span className="lp-gain">+{gainOf(team)} pts</span> : <span />}
              </AppLink>
            </li>
          ))}
        </ol>
      </section>
      <div className="lp-c-foot">
        <section className="lp-c-people" aria-label="People this week">
          <h2 className="lp-board-title">People this week</h2>
          <div className="lp-c-people-grid">
            {measures.slice(0, 3).map((measure) => (
              <TopOne key={measure.key} measure={measure} rows={everyone} />
            ))}
          </div>
          <p className="lp-c-me ph-no-capture">
            You: {me.hugsGiven} hugs given · {me.hugsReceived} hugs received · {me.kudosReceived} kudos received · level {me.level} · {me.hoggies} hoggies
          </p>
        </section>
        <section className="lp-c-people" aria-label="Emojis within reach">
          <h2 className="lp-board-title">Within your reach</h2>
          <UnlockList unlocks={within} />
        </section>
      </div>
    </div>
  );
}

function Lane({ team }: { team: Team }) {
  const share = team.of === 0 ? 0 : team.joined / team.of;
  return (
    <span className="lp-lane" role="img" aria-label={`${team.joined} of ${team.of} joined in`}>
      <span className="lp-lane-track" />
      {team.before !== null && team.before > 0 && <span className="lp-lane-ghost" style={{ left: `${(team.before / team.of) * 100}%` }} title="This time last week" />}
      <span className="lp-lane-runner" style={{ left: `${share * 100}%` }}>
        <HedgehogStar size={28} />
      </span>
      <span className="lp-lane-finish" />
    </span>
  );
}

function TopOne({ measure, rows }: { measure: Measure; rows: Member[] }) {
  const leader = ranked(rows, measure).find((row) => valueOf(row, measure) > 0);
  return (
    <div className="lp-c-top">
      <p className="lp-c-top-title">{measure.title}</p>
      {leader === undefined ? (
        <p className="lp-award-empty">
          <WithEmoji text={measure.firstWays} />
        </p>
      ) : (
        <AppLink href={hrefOf({ kind: "person", person: leader.person })} className="lp-award-row ph-no-capture">
          <MemberFace face={leader.face} className="lp-face" />
          <span className="lp-row-name">{leader.name}</span>
          <span className="lp-row-figure">{valueOf(leader, measure)}</span>
        </AppLink>
      )}
    </div>
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
      <UnlockList unlocks={within} />
    </section>
  );
}

function UnlockList({ unlocks: within }: { unlocks: Unlock[] }) {
  return (
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

function Tally({ figure, term }: { figure: number; term: string }) {
  return (
    <div className="lp-tally">
      <dd>{figure}</dd>
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

function valueOf(row: Member, { key }: Measure) {
  return row[key];
}

function ranked(rows: Member[], measure: Measure) {
  return rows.toSorted((first, second) => valueOf(second, measure) - valueOf(first, measure));
}

function gainOf({ joined, of, before }: Team) {
  if (before === null) return 0;
  return Math.round(((joined - before) / of) * 100);
}
