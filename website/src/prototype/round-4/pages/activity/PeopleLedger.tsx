// PROTOTYPE (#625, round 4): layout C of the activity page, a people ledger: one row per person you exchanged with, a four-week strip of your exchanges, and your story with them on demand. Never merge to main.
import type { Album, Moment } from "../../../round-3/album";
import { AppLink } from "../../../../AppLink";
import { hrefOf } from "../../address";
import { useActivity } from "./history";
import { Face, firstNameOf, HoggieFound, isHug, isOpening, isThanks, Name, OpeningLine, PageHead, personIn, plural, Quote, Segmented, TeamTag, type Hug, type Thanks } from "./parts";
import { clockOf, dayLabelOf, groupBy, lastDays, startOfDay, startOfWeek, weekPhraseOf } from "./time";
import { useHashParam } from "./useHashParam";
import "./activity.css";

const stripDays = 28;

const withWhom = ["everyone", "thanked", "thanked-you"] as const;

type WithWhom = (typeof withWhom)[number];

const orders = ["latest", "closest"] as const;

type Order = (typeof orders)[number];

const orderOptions: { value: Order; label: string }[] = [
  { value: "latest", label: "Latest" },
  { value: "closest", label: "Closest" },
];

function warmthOf({ gave, got, packs, hugs }: Exchange) {
  return 3 * (gave + got) + 2 * packs + hugs;
}

const sorts: Record<Order, (first: Exchange, second: Exchange) => number> = {
  latest: (first, second) => second.lastAt - first.lastAt,
  closest: (first, second) => warmthOf(second) - warmthOf(first) || second.lastAt - first.lastAt,
};

const withOptions: { value: WithWhom; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "thanked", label: "You thanked" },
  { value: "thanked-you", label: "Thanked you" },
];

type Exchange = { person: string; moments: Moment[]; lastAt: number; gave: number; got: number; hugs: number; packs: number };

function exchangesOf(moments: Moment[]): Exchange[] {
  const byPerson = new Map<string, Moment[]>();
  for (const moment of moments) byPerson.set(moment.person, [...(byPerson.get(moment.person) ?? []), moment]);
  return [...byPerson.entries()].map(([person, theirs]) => ({
    person,
    moments: theirs,
    lastAt: Math.max(...theirs.map(({ at }) => at)),
    gave: theirs.filter(({ kind }) => kind === "thoughtful-given").length,
    got: theirs.filter(({ kind }) => kind === "thoughtful-received").length,
    hugs: theirs.filter(isHug).length,
    packs: theirs.filter(isOpening).length,
  }));
}

const keeps: Record<WithWhom, (exchange: Exchange) => boolean> = {
  everyone: () => true,
  thanked: ({ gave }) => gave > 0,
  "thanked-you": ({ got }) => got > 0,
};

function teamsTouched(album: Album, exchanges: Exchange[]) {
  return new Set(exchanges.flatMap(({ person }) => personIn(album, person)?.teams ?? [])).size;
}

export function PeopleLedger() {
  const { album, moments } = useActivity();
  const [whom, chooseWhom] = useHashParam("with", withWhom, "everyone");
  const [order, chooseOrder] = useHashParam("order", orders, "latest");
  const exchanges = exchangesOf(moments).toSorted(sorts[order]);
  const [open, chooseOpen] = useHashParam("person", ["", ...exchanges.map(({ person }) => person)], "");
  const shown = exchanges.filter(keeps[whom]);
  return (
    <div className="r4-act r4-act-ledger">
      <PageHead title="Your people" lede={`Everyone you swapped thanks or hugs with: ${plural(exchanges.length, "person", "people")} across ${plural(teamsTouched(album, exchanges), "team")}. Open a row to read your story together.`}>
        <div className="r4-act-controls">
          <Segmented label="Show" options={withOptions} value={whom} onChoose={chooseWhom} />
          <Segmented label="Order" options={orderOptions} value={order} onChoose={chooseOrder} />
        </div>
      </PageHead>
      <Legend />
      <ol className="r4-act-rows">
        {shown.map((exchange) => (
          <Row key={exchange.person} album={album} exchange={exchange} open={open === exchange.person} onToggle={() => chooseOpen(open === exchange.person ? "" : exchange.person)} />
        ))}
      </ol>
    </div>
  );
}

function Legend() {
  return (
    <p className="r4-act-legend" aria-hidden="true">
      <span>Last four weeks:</span>
      <span>
        <i className="r4-act-mark r4-act-mark-gave" /> you thanked
      </span>
      <span>
        <i className="r4-act-mark r4-act-mark-got" /> thanked you
      </span>
      <span>
        <i className="r4-act-mark r4-act-mark-pack" /> pack opened
      </span>
      <span>
        <i className="r4-act-mark r4-act-mark-hug" /> hug
      </span>
    </p>
  );
}

function tallyOf({ gave, got, hugs, packs }: Exchange) {
  return [gave > 0 && `thanked ${gave}×`, got > 0 && `thanked you ${got}×`, packs > 0 && plural(packs, "pack"), hugs > 0 && plural(hugs, "hug")].filter(Boolean).join(" · ");
}

function latestWordsOf(exchange: Exchange) {
  return exchange.moments.toSorted((first, second) => second.at - first.at).find(isThanks);
}

function Row({ album, exchange, open, onToggle }: { album: Album; exchange: Exchange; open: boolean; onToggle: () => void }) {
  const words = latestWordsOf(exchange);
  return (
    <li className={`r4-act-row ${open ? "r4-act-row-open" : ""}`}>
      <div className="r4-act-row-line">
        <div className="r4-act-row-who">
          <Face album={album} person={exchange.person} />
          <div>
            <Name album={album} person={exchange.person} />
            <TeamTag album={album} person={exchange.person} />
          </div>
        </div>
        <Strip moments={exchange.moments} />
        <p className="r4-act-row-tally">{tallyOf(exchange)}</p>
        <button type="button" className="r4-act-row-toggle" aria-expanded={open} onClick={onToggle}>
          <span className="r4-act-row-words">{words === undefined ? "Only hugs so far" : `“${words.message}”`}</span>
          <span className="r4-act-chevron" aria-hidden="true">
            {open ? "▴" : "▾"}
          </span>
        </button>
      </div>
      {open && <Story album={album} exchange={exchange} />}
    </li>
  );
}

function marksOf(moments: Moment[]) {
  return [
    moments.some(({ kind }) => kind === "thoughtful-given") && "gave",
    moments.some(({ kind }) => kind === "thoughtful-received") && "got",
    moments.some(isOpening) && "pack",
    moments.some(isHug) && "hug",
  ].filter((mark): mark is string => mark !== false);
}

function Strip({ moments }: { moments: Moment[] }) {
  const days = lastDays(stripDays);
  return (
    <span className="r4-act-strip" aria-hidden="true">
      {days.map((dayStart) => (
        <span key={dayStart} className="r4-act-strip-day">
          {marksOf(moments.filter(({ at }) => startOfDay(at) === dayStart)).map((mark) => (
            <i key={mark} className={`r4-act-mark r4-act-mark-${mark}`} />
          ))}
        </span>
      ))}
    </span>
  );
}

type Beat = { kind: "moment"; moment: Moment } | { kind: "hugs"; at: number; weekStart: number; received: Hug[]; given: Hug[] };

function beatsOf(moments: Moment[]): Beat[] {
  const hugsByWeek = groupBy(moments.filter(isHug), ({ at }) => startOfWeek(at)).map(({ key, members }): Beat => ({
    kind: "hugs",
    at: Math.max(...members.map(({ at }) => at)),
    weekStart: key,
    received: members.filter(({ kind }) => kind === "hug-received"),
    given: members.filter(({ kind }) => kind === "hug-given"),
  }));
  const others = moments.filter((moment) => !isHug(moment)).map((moment): Beat => ({ kind: "moment", moment }));
  return [...others, ...hugsByWeek].toSorted((first, second) => atOf(first) - atOf(second));
}

function atOf(beat: Beat) {
  return beat.kind === "hugs" ? beat.at : beat.moment.at;
}

function Story({ album, exchange }: { album: Album; exchange: Exchange }) {
  const person = personIn(album, exchange.person);
  const first = person === undefined ? "them" : firstNameOf(person.name);
  return (
    <div className="r4-act-story">
      <ol className="r4-act-thread">
        {beatsOf(exchange.moments).map((beat) => (
          <Beat key={beat.kind === "hugs" ? `hugs-${beat.weekStart}` : `${beat.moment.kind}-${beat.moment.at}`} album={album} first={first} beat={beat} />
        ))}
      </ol>
      <AppLink href={hrefOf({ kind: "person", key: exchange.person })} className="r4-act-story-link">
        Open {first}’s page →
      </AppLink>
    </div>
  );
}

function Beat({ album, first, beat }: { album: Album; first: string; beat: Beat }) {
  if (beat.kind === "hugs") return <HugBeat first={first} beat={beat} />;
  const { moment } = beat;
  if (isThanks(moment)) return <Bubble thanks={moment} />;
  if (isOpening(moment))
    return (
      <li className="r4-act-beat-center">
        <HoggieFound album={album} opening={moment} size={36} />
        <span>
          <OpeningLine album={album} opening={moment} /> · {dayLabelOf(moment.at)}
        </span>
      </li>
    );
  return null;
}

function Bubble({ thanks }: { thanks: Thanks }) {
  const given = thanks.kind === "thoughtful-given";
  return (
    <li className={`r4-act-bubble r4-act-bubble-${given ? "given" : "received"}`}>
      <Quote message={thanks.message} tone={given ? "given" : "received"} />
      <span className="r4-act-bubble-meta">
        {given ? "You" : "To you"} · {dayLabelOf(thanks.at)}, {clockOf(thanks.at)}
        {thanks.kind === "thoughtful-given" && thanks.packed && " · pack earned"}
      </span>
    </li>
  );
}

function timesOf(count: number) {
  if (count === 1) return "once";
  if (count === 2) return "twice";
  return `${count} times`;
}

function hugWordsOf(first: string, { received, given }: Extract<Beat, { kind: "hugs" }>) {
  const words = [received.length > 0 && `${first} hugged you ${timesOf(received.length)}`, given.length > 0 && `you hugged ${first} ${timesOf(given.length)}`].filter(Boolean).join(", ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function HugBeat({ first, beat }: { first: string; beat: Extract<Beat, { kind: "hugs" }> }) {
  return (
    <li className="r4-act-beat-center r4-act-quiet">
      {hugWordsOf(first, beat)} · {weekPhraseOf(beat.weekStart)}
    </li>
  );
}
