// PROTOTYPE (throwaway, branch prototype/activity-never-empty, never merged). Silthus/personal#218.
// Round 1: three variants of the Activity page for the empty, quiet and thanked states,
// switchable via ?variant=A|B|C and ?state=empty|quiet|thanked on the existing /activity route.
import type { ReactNode } from "react";
import { hedgehogHeartPng } from "@posthog/brand/hoggies/png";
import { NamedEmoji } from "../Emoji";
import { MemberFace } from "../Face";
import { PageTitle } from "../PageTitle";
import type { Face } from "../shell";
import { SlackLink } from "../SlackLink";
import { SlackMessage, SlackReaction, SlackText } from "./SlackMessage";
import { PrototypeSwitcher, usePrototypeParam, type Choice } from "./PrototypeSwitcher";
import "./activityPrototype.css";

type Way = "hug" | "kudos";
type Who = { name: string; face: Face };
type Thanks = { way: Way; from: Who; day: string; words: string; permalink: string };
type Quest = { way: Way; goal: string; how: string; done: number; target: number; reward: string };
type Step = { way: Way; title: string; why: string; button: string; href: string; hugging: { author: Who; words: string } | null };
type Situation = { received: Thanks[]; givenThisWeek: number; lastWeek: { hugsGiven: number; kudosGiven: number; hugsReceived: number; kudosReceived: number } | null; quests: Quest[]; next: Step };

const slack = "slack://open";

const emoji = "hedgehug";

const variants: Choice[] = [
  { key: "A", label: "(One next step) · low use: week tabs" },
  { key: "B", label: "(Quest board) · low use: week tabs" },
  { key: "C", label: "(Thanks feed) · low use: week tabs" },
];

const states: Choice[] = [
  { key: "empty", label: "Empty" },
  { key: "quiet", label: "Quiet" },
  { key: "thanked", label: "Thanked" },
];

function who(name: string): Who {
  return { name, face: { kind: "initials", initials: name.split(" ").map((word) => word.charAt(0)).join("") } };
}

const ines = who("Ines Okafor");
const juno = who("Juno Park");
const fen = who("Fen Marlowe");
const alex = who("Alex Lee");

const hugAMessage: Quest = { way: "hug", goal: "Hug a teammate's message", how: "React with :hedgehug: to any message in Slack.", done: 0, target: 1, reward: "+20 XP and a hoggie" };

const giveAKudos: Quest = { way: "kudos", goal: "Give a kudos to someone", how: "Write :hedgehug: @name and what they did, in any channel.", done: 0, target: 1, reward: "+20 XP and a hoggie" };

const thankSomeoneNew: Quest = { way: "kudos", goal: "Thank someone new", how: "A kudos to someone you haven't thanked before.", done: 0, target: 1, reward: "+20 XP and a hoggie" };

const firstHug: Step = { way: "hug", title: "Give your first hug", why: "React with :hedgehug: to a teammate's message in Slack. That's a hug: they see it, and you both get XP.", button: "Open Slack", href: slack, hugging: { author: alex, words: "Shipped the fix for the flaky deploy, should be green now." } };

const situations: Record<string, Situation> = {
  empty: { received: [], givenThisWeek: 0, lastWeek: null, quests: [hugAMessage, giveAKudos], next: firstHug },
  quiet: {
    received: [],
    givenThisWeek: 0,
    lastWeek: { hugsGiven: 2, kudosGiven: 1, hugsReceived: 3, kudosReceived: 0 },
    quests: [hugAMessage, thankSomeoneNew],
    next: { way: "hug", title: "Hug a message today", why: "React with :hedgehug: to a teammate's message. Your first hug each day pays extra XP.", button: "Open Slack", href: slack, hugging: { author: juno, words: "Docs for the new export flow are up, comments welcome." } },
  },
  thanked: {
    received: [
      { way: "kudos", from: fen, day: "Wed", words: "The demo today was brilliant, the way you explained the data model clicked for everyone.", permalink: slack },
      { way: "hug", from: ines, day: "Tue", words: "Pushed the retry fix for the webhook queue.", permalink: slack },
      { way: "hug", from: juno, day: "Tue", words: "Pushed the retry fix for the webhook queue.", permalink: slack },
    ],
    givenThisWeek: 0,
    lastWeek: { hugsGiven: 2, kudosGiven: 1, hugsReceived: 3, kudosReceived: 0 },
    quests: [hugAMessage, giveAKudos],
    next: { way: "hug", title: "Hug Fen's kudos back", why: "Fen thanked you on Wednesday. React with :hedgehug: to their message and they get a hug back.", button: "Open Fen's message", href: slack, hugging: { author: fen, words: "The demo today was brilliant, the way you explained the data model clicked for everyone." } },
  },
};

export function ActivityPrototype() {
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

function readoutOf(state: string, { received, givenThisWeek, lastWeek, quests, next }: Situation) {
  const done = quests.filter((quest) => quest.done >= quest.target).length;
  return `state=${state} · received this week ${received.length} · given ${givenThisWeek} · last week ${lastWeek === null ? "none" : "yes"} · quests ${done}/${quests.length} · next: ${next.way}`;
}

function VariantA({ situation: { received, lastWeek, quests, next } }: { situation: Situation }) {
  return (
    <div className="al-page-body ap-a">
      <p className="al-eyebrow">Activity</p>
      <PageTitle tab="Activity" size="hero">
        Your week
      </PageTitle>
      <section className="ap-next" aria-label="Your next step">
        <div className="ap-next-words">
          <WayChip way={next.way} />
          <h2 className="ap-next-title">{next.title}</h2>
          <p className="ap-next-why">
            <WithEmoji text={next.why} />
          </p>
          <SlackLink chatUrl={next.href} variant="primary" size="lg">
            {next.button}
          </SlackLink>
        </div>
        {next.hugging !== null && <HugPicture hugging={next.hugging} />}
      </section>
      <div className="ap-a-grid">
        <section className="ap-panel" aria-label="This week's quests">
          <h3 className="ap-panel-title">This week's quests · {doneCountOf(quests)}</h3>
          <QuestChecks quests={quests} />
        </section>
        <section className="ap-panel" aria-label="Who thanked you">
          <h3 className="ap-panel-title">Who thanked you this week</h3>
          {received.length === 0 ? <p className="ap-quiet">Nobody yet. Hugs and kudos you get show here, with who sent them.</p> : <ReceivedList received={received} />}
        </section>
      </div>
      {lastWeek !== null && (
        <p className="ap-last">
          Last week you gave {lastWeek.hugsGiven} hugs and {lastWeek.kudosGiven} kudos, and got {lastWeek.hugsReceived} hugs. <a href="#last-week">Read last week</a>
        </p>
      )}
    </div>
  );
}

function VariantB({ situation: { received, givenThisWeek, quests, next } }: { situation: Situation }) {
  const nextQuest = quests.find((quest) => quest.done < quest.target && quest.way === next.way) ?? quests[0]!;
  return (
    <div className="al-page-body ap-b">
      <p className="al-eyebrow">Activity · this week</p>
      <PageTitle tab="Activity" size="hero">
        Two quests this week
      </PageTitle>
      <p className="al-lede">Two ways to thank: a hug is a reaction, a kudos is a message.</p>
      <ol className="ap-b-quests">
        {quests.map((quest) => (
          <li key={quest.goal} className="ap-b-quest" data-next={quest === nextQuest ? "" : undefined}>
            <p className="ap-b-tier">
              <WayWord way={quest.way} />
            </p>
            <h2 className="ap-b-goal">{quest === nextQuest ? next.title : quest.goal}</h2>
            <p className="ap-b-how">
              <WithEmoji text={quest === nextQuest ? next.why : quest.how} />
            </p>
            <Progress done={quest.done} target={quest.target} />
            <p className="ap-b-reward">{quest.reward}</p>
            {quest === nextQuest ? (
              <SlackLink chatUrl={next.href} variant="primary" size="lg">
                {next.button}
              </SlackLink>
            ) : (
              <p className="ap-quiet">Any time this week.</p>
            )}
          </li>
        ))}
      </ol>
      <section className="ap-b-week" aria-label="Your week so far">
        <h3 className="ap-panel-title">Your week so far</h3>
        <WeekStrip received={received} givenThisWeek={givenThisWeek} />
        {received.length === 0 ? (
          <p className="ap-quiet">Nothing came in yet. When a teammate hugs your message or gives you a kudos, you see who here.</p>
        ) : (
          <ul className="ap-b-chips">
            {received.map((thanks, index) => (
              <li key={index} className="ap-b-chip">
                <MemberFace face={thanks.from.face} className="ap-face-sm" />
                <span className="ph-no-capture">
                  {thanks.from.name} {thanks.way === "hug" ? "hugged your message" : "gave you a kudos"} · {thanks.day}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const today = "Thu";

function WeekStrip({ received, givenThisWeek }: { received: Thanks[]; givenThisWeek: number }) {
  return (
    <ol className="ap-b-days">
      {weekdays.map((day) => {
        const came = received.filter((thanks) => thanks.day === day);
        return (
          <li key={day} className="ap-b-day" data-today={day === today ? "" : undefined} data-later={weekdays.indexOf(day) > weekdays.indexOf(today) ? "" : undefined}>
            <span className="ap-b-day-name">{day === today ? "Today" : day}</span>
            <span className="ap-b-day-marks">
              {came.map((thanks, index) => (
                <span key={index} className="ap-b-mark" data-way={thanks.way} title={`${thanks.from.name}: ${thanks.way}`} />
              ))}
              {day === today && givenThisWeek === 0 && <span className="ap-b-turn">your turn</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function VariantC({ situation: { received, lastWeek, quests, next } }: { situation: Situation }) {
  return (
    <div className="ap-c">
      <div className="ap-c-main">
        <p className="al-eyebrow">Activity</p>
        <PageTitle tab="Activity" size="hero">
          Thanks
        </PageTitle>
        <p className="al-lede">Every hug and kudos you give and get, newest first.</p>
        <ol className="ap-c-feed">
          <li className="ap-c-turn">
            <span className="ap-c-turn-mark" aria-hidden="true">
              <NamedEmoji name={emoji} image={hedgehogHeartPng} />
            </span>
            <div className="ap-c-item-words">
              <p className="ap-c-turn-label">Your turn</p>
              <p className="ap-c-item-head">{next.title}</p>
              <p className="ap-quiet">
                <WithEmoji text={next.why} />
              </p>
            </div>
            <SlackLink chatUrl={next.href} variant="primary">
              {next.button}
            </SlackLink>
          </li>
          {received.map((thanks, index) => (
            <FeedItem key={index} thanks={thanks} />
          ))}
          {received.length === 0 && <GhostItems />}
        </ol>
      </div>
      <aside className="ap-c-rail" aria-label="This week">
        <section className="ap-panel">
          <h3 className="ap-panel-title">Quests · {doneCountOf(quests)}</h3>
          <QuestChecks quests={quests} />
        </section>
        {lastWeek !== null && (
          <section className="ap-panel">
            <h3 className="ap-panel-title">Last week</h3>
            <dl className="ap-c-tally">
              <Tally figure={lastWeek.hugsGiven + lastWeek.kudosGiven} term="you gave" />
              <Tally figure={lastWeek.hugsReceived + lastWeek.kudosReceived} term="you got" />
            </dl>
          </section>
        )}
      </aside>
    </div>
  );
}

function FeedItem({ thanks }: { thanks: Thanks }) {
  return (
    <li className="ap-c-item">
      <MemberFace face={thanks.from.face} className="ap-face" />
      <div className="ap-c-item-words">
        <p className="ap-c-item-head ph-no-capture">
          {thanks.from.name} {thanks.way === "hug" ? "hugged your message" : "gave you a kudos"} <span className="ap-quiet">· {thanks.day}</span>
        </p>
        <blockquote className="ap-c-quote" data-way={thanks.way}>
          {thanks.words}
        </blockquote>
      </div>
      <WayChip way={thanks.way} />
    </li>
  );
}

function GhostItems() {
  return (
    <>
      <li className="ap-c-item ap-c-ghost" aria-hidden="true">
        <span className="ap-face ap-ghost-face" />
        <div className="ap-c-item-words">
          <p className="ap-c-item-head">A teammate hugged your message</p>
          <p className="ap-quiet">When someone reacts with :hedgehug: to what you wrote, it lands here.</p>
        </div>
      </li>
      <li className="ap-c-item ap-c-ghost" aria-hidden="true">
        <span className="ap-face ap-ghost-face" />
        <div className="ap-c-item-words">
          <p className="ap-c-item-head">A teammate gave you a kudos</p>
          <p className="ap-quiet">Their words show here, with who sent them.</p>
        </div>
      </li>
    </>
  );
}

function ReceivedList({ received }: { received: Thanks[] }) {
  return (
    <ul className="ap-received">
      {received.map((thanks, index) => (
        <li key={index} className="ap-received-line">
          <MemberFace face={thanks.from.face} className="ap-face" />
          <div>
            <p className="ap-received-who ph-no-capture">
              {thanks.from.name} <span className="ap-quiet">{thanks.way === "hug" ? "hugged your message" : "gave you a kudos"} · {thanks.day}</span>
            </p>
            <p className="ap-received-words">{thanks.words}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuestChecks({ quests }: { quests: Quest[] }) {
  return (
    <ul className="ap-checks">
      {quests.map((quest) => (
        <li key={quest.goal} className="ap-check" data-done={quest.done >= quest.target ? "" : undefined}>
          <span className="ap-check-box" aria-hidden="true" />
          <span className="ap-check-words">
            <span className="ap-check-goal">{quest.goal}</span>
            <span className="ap-check-note">
              <WithEmoji text={quest.how} />
            </span>
            <span className="ap-check-note">{quest.reward}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function HugPicture({ hugging }: { hugging: { author: Who; words: string } }) {
  return (
    <div className="ap-hug-picture" aria-hidden="true">
      <SlackMessage sender={hugging.author} at="10:42">
        <SlackText>{hugging.words}</SlackText>
        <SlackReaction emoji={emoji} image={hedgehogHeartPng} count={1} />
      </SlackMessage>
    </div>
  );
}

function Progress({ done, target }: { done: number; target: number }) {
  return (
    <span className="ap-progress" role="img" aria-label={`${done} of ${target}`}>
      <span className="ap-progress-fill" style={{ width: `${Math.max(4, (done / target) * 100)}%` }} />
    </span>
  );
}

function Tally({ figure, term }: { figure: number; term: string }) {
  return (
    <div>
      <dd className="ap-c-figure">{figure}</dd>
      <dt>{term}</dt>
    </div>
  );
}

function WayChip({ way }: { way: Way }) {
  return (
    <span className="ap-way" data-way={way}>
      <WayWord way={way} />
    </span>
  );
}

function WayWord({ way }: { way: Way }) {
  return <>{way === "hug" ? "Hug · a reaction" : "Kudos · a message"}</>;
}

function WithEmoji({ text }: { text: string }): ReactNode {
  return text.split(`:${emoji}:`).flatMap((part, index) => (index === 0 ? [part] : [<NamedEmoji key={index} name={emoji} image={hedgehogHeartPng} />, part]));
}

function doneCountOf(quests: Quest[]) {
  return `${quests.filter((quest) => quest.done >= quest.target).length} of ${quests.length}`;
}
