// PROTOTYPE (#625, round 3): HedgeHug's three Slack moments, built from the in-memory album. Never merge to main.
import type { ReactNode } from "react";
import { HedgehogMailbox, HedgehogSitting, HedgehogTownCrier } from "../../../hoggies";
import { MemberFace } from "../../art";
import { personOf, type Album, type Person } from "../album";
import { Accessory, Context, DayDivider, FaceChip, KudosEmoji, Mention, Message, Section, WebsiteButton, kudosEmoji, type Author, type Reaction, type Replies } from "./parts";

export type Pane = "kudos" | "team-workflows" | "general" | "dm-hedgehug";

export type ThreadId = "thread" | "thread-noor" | "thread-mei" | "thread-live";

export type Focus = "omar" | "recap" | "weekly" | null;

type Outcome = "new" | "known" | "next-week";

type Thread = { pane: Pane; parent: ReactNode; reply: ReactNode };

function firstName(name: string) {
  return name.split(" ")[0]!;
}

function someone(album: Album, key: string): Person {
  return personOf(album, key)!;
}

function authorOf(album: Album, key: string): Author {
  const { name, face } = someone(album, key);
  return { kind: "person", name, face };
}

function me(album: Album): Author {
  return { kind: "person", name: album.me.name, face: album.me.face };
}

export function clockOf(at: number) {
  return new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function arrivingIn(album: Album, keys: string[], person: Person) {
  const packed = new Set(album.packs.map((pack) => pack.person).concat(person.key));
  return keys.filter((key) => packed.has(key) && someone(album, key).collectedAt === null).length;
}

function teamLinesOf(album: Album, person: Person) {
  return album.teams
    .filter(({ team }) => person.teams.includes(team))
    .map((team) => {
      const held = team.held + arrivingIn(album, team.people, person);
      return { name: team.name, held, total: team.total, complete: held === team.total };
    });
}

function PackReply({ album, personKey, outcome, time }: { album: Album; personKey: string; outcome: Outcome; time: string }) {
  const person = someone(album, personKey);
  const first = firstName(person.name);
  const waiting = outcome !== "next-week" && album.packs.some((pack) => pack.person === personKey);
  return (
    <Message author={{ kind: "app" }} time={time}>
      <div className="sm-blocks">
        <Section accessory={<ReplyArt person={person} outcome={outcome} />}>
          <ReplyWords album={album} person={person} outcome={outcome} />
        </Section>
        <div className="sm-actions">
          {waiting ? <WebsiteButton label="Open your pack" path="/book" hash="#packs" primary /> : <WebsiteButton label={`See ${first}'s page`} path="/book" hash={`#people/${personKey}`} />}
        </div>
        <Context>
          {outcome === "next-week" ? (
            <span>One pack per person each week.</span>
          ) : waiting ? (
            <span>{firstName(album.me.name)}'s pack · opens on the HedgeHug website</span>
          ) : (
            <span>
              <span className="sm-opened">✓ Opened</span> · {first} is in your album
            </span>
          )}
        </Context>
      </div>
    </Message>
  );
}

function ReplyWords({ album, person, outcome }: { album: Album; person: Person; outcome: Outcome }) {
  const first = firstName(person.name);
  if (outcome === "next-week")
    return (
      <>
        <p>
          <strong>Kudos counted.</strong>
        </p>
        <p>Your next pack for {first} comes next week.</p>
      </>
    );
  if (outcome === "known")
    return (
      <>
        <p>
          <strong>A pack for thanking {first}</strong>
        </p>
        <p>{first} is already in your album, so this pack holds a hoggie.</p>
      </>
    );
  return (
    <>
      <p>
        <strong>{first} is new in your album</strong>
      </p>
      {teamLinesOf(album, person).map(({ name, held, total, complete }) => (
        <p key={name}>
          {name} {held}/{total}
          {complete ? ": page complete!" : ""}
        </p>
      ))}
    </>
  );
}

function ReplyArt({ person, outcome }: { person: Person; outcome: Outcome }) {
  if (outcome === "known")
    return (
      <Accessory>
        <HedgehogMailbox size={64} />
      </Accessory>
    );
  return (
    <Accessory face>
      <MemberFace face={person.face} className="" />
    </Accessory>
  );
}

const omarReactions: Reaction[] = [
  { emoji: kudosEmoji, count: 4 },
  { emoji: "🙌", count: 3 },
  { emoji: "❤️", count: 2 },
];

function OmarKudos({ album, replies, focus }: { album: Album; replies?: Replies; focus: boolean }) {
  return (
    <Message author={me(album)} time="7:02 AM" reactions={omarReactions} replies={replies} focus={focus}>
      <p className="sm-text">
        Thanks <Mention name={someone(album, "k:omar").name} /> for jumping into my ask thread at 7pm, you unblocked the whole launch <KudosEmoji />
      </p>
    </Message>
  );
}

function NoorKudos({ album, replies }: { album: Album; replies?: Replies }) {
  return (
    <Message author={me(album)} time="11:20 AM" reactions={[{ emoji: kudosEmoji, count: 2 }]} replies={replies}>
      <p className="sm-text">
        Thanks again <Mention name={someone(album, "k:noor").name} />, your release checklist saved us another afternoon today <KudosEmoji />
      </p>
    </Message>
  );
}

function MeiKudos({ album, replies }: { album: Album; replies?: Replies }) {
  return (
    <Message author={me(album)} time="8:14 AM" reactions={[{ emoji: kudosEmoji, count: 5 }, { emoji: "🎉", count: 2 }]} replies={replies}>
      <p className="sm-text">
        <Mention name={someone(album, "k:mei").name} /> the demo was brilliant, the way you explained the data model clicked for everyone <KudosEmoji />
      </p>
    </Message>
  );
}

function LiveKudos({ album, replies }: { album: Album; replies?: Replies }) {
  const echo = album.lastSlack!;
  return (
    <Message author={me(album)} time={clockOf(echo.at)} replies={replies}>
      <p className="sm-text">
        <Mention name={someone(album, echo.person).name} /> {echo.message} <KudosEmoji />
      </p>
    </Message>
  );
}

function liveOutcome(album: Album): Outcome {
  const echo = album.lastSlack!;
  if (!echo.packed) return "next-week";
  return echo.personIsNew ? "new" : "known";
}

export function threadOf(album: Album, thread: ThreadId): Thread {
  if (thread === "thread-noor") return { pane: "team-workflows", parent: <NoorKudos album={album} />, reply: <PackReply album={album} personKey="k:noor" outcome="next-week" time="11:20 AM" /> };
  if (thread === "thread-mei") return { pane: "general", parent: <MeiKudos album={album} />, reply: <PackReply album={album} personKey="k:mei" outcome="known" time="8:14 AM" /> };
  if (thread === "thread-live" && album.lastSlack !== null) return { pane: "team-workflows", parent: <LiveKudos album={album} />, reply: <PackReply album={album} personKey={album.lastSlack.person} outcome={liveOutcome(album)} time={clockOf(album.lastSlack.at)} /> };
  return { pane: "team-workflows", parent: <OmarKudos album={album} focus={false} />, reply: <PackReply album={album} personKey="k:omar" outcome="new" time="7:02 AM" /> };
}

function repliesOf(thread: ThreadId, open: ThreadId | null, last: string) {
  return { thread, count: 1, last, open: open === thread };
}

export function TeamWorkflows({ album, open, focus }: { album: Album; open: ThreadId | null; focus: Focus }) {
  return (
    <>
      <DayDivider day="Saturday, October 17th" />
      <Message author={authorOf(album, "k:hana")} time="9:41 AM" reactions={[{ emoji: "👀", count: 3 }]}>
        <p className="sm-text">Release notes draft is in the doc, shout if anything is missing before Monday.</p>
      </Message>
      <NoorKudos album={album} replies={repliesOf("thread-noor", open, "Yesterday at 11:20 AM")} />
      <DayDivider day="Today" />
      <OmarKudos album={album} focus={focus === "omar"} replies={repliesOf("thread", open, "Today at 7:02 AM")} />
      <Message author={authorOf(album, "k:omar")} time="7:15 AM" reactions={[{ emoji: kudosEmoji, count: 1, mine: true }]}>
        <p className="sm-text">Happy to, it was a fun one to untangle.</p>
      </Message>
      {album.lastSlack !== null && <LiveKudos album={album} replies={repliesOf("thread-live", open, `Today at ${clockOf(album.lastSlack.at)}`)} />}
    </>
  );
}

export function General({ album, open }: { album: Album; open: ThreadId | null }) {
  return (
    <>
      <DayDivider day="Saturday, October 17th" />
      <Message author={authorOf(album, "k:kai")} time="7:58 AM" reactions={[{ emoji: "🙏", count: 6 }]}>
        <p className="sm-text">The recording of yesterday's demo is up in the shared drive.</p>
      </Message>
      <MeiKudos album={album} replies={repliesOf("thread-mei", open, "Yesterday at 8:14 AM")} />
      <Message author={authorOf(album, "k:leo")} time="12:03 PM" reactions={[{ emoji: kudosEmoji, count: 3, mine: true }, { emoji: "🥐", count: 4 }]}>
        <p className="sm-text">There are pastries in the kitchen, help yourselves.</p>
      </Message>
    </>
  );
}

type HugWeek = { day: string; given: number; received: number; gaveTo: string[]; gaveToOthers: number; gotFrom: string[] };

const hugWeeks: HugWeek[] = [
  { day: "Monday, October 5th", given: 9, received: 6, gaveTo: ["k:sofia", "k:noor"], gaveToOthers: 1, gotFrom: ["k:felix", "k:priya"] },
  { day: "Monday, October 12th", given: 14, received: 9, gaveTo: ["k:priya", "k:sofia", "k:felix", "k:hana"], gaveToOthers: 3, gotFrom: ["k:omar", "k:hana", "k:mei"] },
];

function FaceRow({ album, keys, label, more = 0 }: { album: Album; keys: string[]; label: string; more?: number }) {
  const shown = keys.map((key) => someone(album, key));
  return (
    <Context>
      <span>{label}</span>
      {shown.map(({ key, name, face }) => (
        <FaceChip key={key} name={name} face={face} />
      ))}
      <span>
        {shown.map(({ name }) => firstName(name)).join(", ")}
        {more > 0 ? ` and ${more} more` : ""}
      </span>
    </Context>
  );
}

function HugRecap({ album, week, focus }: { album: Album; week: HugWeek; focus: boolean }) {
  return (
    <Message author={{ kind: "app" }} time="9:00 AM" focus={focus}>
      <div className="sm-blocks">
        <p className="sm-block-header">Your hugs last week</p>
        <Section
          accessory={
            <Accessory>
              <HedgehogSitting size={64} />
            </Accessory>
          }
        >
          <p>
            You hugged teammates <strong>{week.given} times</strong> and got <strong>{week.received} hugs</strong> back.
          </p>
          <p>
            That's <strong>+{week.given} XP</strong>. A hug is a <KudosEmoji /> reaction on someone's message.
          </p>
        </Section>
        <FaceRow album={album} keys={week.gaveTo} label="You hugged" more={week.gaveToOthers} />
        <FaceRow album={album} keys={week.gotFrom} label="Hugged you" />
        <Context>
          <span>Nothing to do, this is just a look back. See you next Monday.</span>
        </Context>
      </div>
    </Message>
  );
}

export function HedgeHugDm({ album, focus }: { album: Album; focus: Focus }) {
  return (
    <>
      <div className="sm-intro">
        <h2>HedgeHug</h2>
        <p>Peer recognition with the kudos emoji. Every Monday HedgeHug sends you a short look back at your hugs. That's the only direct message it sends.</p>
      </div>
      {hugWeeks.map((week, index) => (
        <div key={week.day}>
          <DayDivider day={week.day} />
          <HugRecap album={album} week={week} focus={focus === "recap" && index === hugWeeks.length - 1} />
        </div>
      ))}
    </>
  );
}

type TopKudos = { from: string; to: string; words: string; reactions: Reaction[] };

const topKudos: TopKudos[] = [
  { from: "k:priya", to: "k:hana", words: "Your incident write-up made it so easy to follow what happened and why. I've sent it to three people already.", reactions: [{ emoji: kudosEmoji, count: 14 }, { emoji: "❤️", count: 9 }] },
  { from: "k:felix", to: "k:mei", words: "Thank you for reviewing my first PR so kindly, I learned more from your comments than from a week of docs.", reactions: [{ emoji: kudosEmoji, count: 11 }, { emoji: "🙌", count: 6 }] },
  { from: "k:sofia", to: "k:leo", words: "You covered support on Friday so I could make it to my kid's play. That meant a lot.", reactions: [{ emoji: kudosEmoji, count: 10 }, { emoji: "🥹", count: 7 }] },
];

const places = ["1.", "2.", "3."];

function TopKudosRow({ album, entry, place }: { album: Album; entry: TopKudos; place: string }) {
  const from = someone(album, entry.from);
  const to = someone(album, entry.to);
  return (
    <div className="sm-top-kudos">
      <div className="sm-top-kudos-who">
        <span className="sm-top-kudos-place">{place}</span>
        <FaceChip name={from.name} face={from.face} />
        <strong>{from.name}</strong>
        <span aria-label="thanked">→</span>
        <FaceChip name={to.name} face={to.face} />
        <strong>{to.name}</strong>
      </div>
      <blockquote className="sm-quote">{entry.words}</blockquote>
      <div className="sm-top-kudos-tally">
        {entry.reactions.map(({ emoji, count }) => (
          <span key={emoji}>
            {emoji === kudosEmoji ? <KudosEmoji /> : emoji} {count}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KudosChannel({ album, focus }: { album: Album; focus: Focus }) {
  return (
    <>
      <div className="sm-intro">
        <h2># kudos</h2>
        <p>Thank teammates here or anywhere. Every Friday afternoon HedgeHug posts the week's top thoughtful kudos here.</p>
      </div>
      <DayDivider day="Friday, October 16th" />
      <Message author={{ kind: "app" }} time="4:00 PM" focus={focus === "weekly"} reactions={[{ emoji: kudosEmoji, count: 12, mine: true }, { emoji: "🎉", count: 5 }]}>
        <div className="sm-blocks">
          <p className="sm-block-header">This week's thoughtful kudos</p>
          <Section
            accessory={
              <Accessory>
                <HedgehogTownCrier size={64} />
              </Accessory>
            }
          >
            <p>
              <strong>18 thoughtful kudos</strong> this week, from 11 people on 5 teams.
            </p>
            <p>Here are the three that got the most love.</p>
          </Section>
          <div className="sm-divider" />
          {topKudos.map((entry, index) => (
            <TopKudosRow key={entry.from} album={album} entry={entry} place={places[index]!} />
          ))}
          <div className="sm-divider" />
          <div className="sm-actions">
            <WebsiteButton label="See this week's leaderboard" path="/leaderboard" />
          </div>
          <Context>
            <span>A thoughtful kudos thanks someone and says why. Give one with the kudos emoji.</span>
          </Context>
        </div>
      </Message>
      <Message author={authorOf(album, "k:hana")} time="4:12 PM" reactions={[{ emoji: kudosEmoji, count: 3 }]}>
        <p className="sm-text">These make my Friday. Thank you Priya, that one was a lot to write up.</p>
      </Message>
    </>
  );
}
