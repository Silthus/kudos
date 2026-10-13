// PROTOTYPE (throwaway, never merged): four workweeks of three giver archetypes, driven through the
// real kudos engine, parser, event bus and progression reducer. No Slack: the simulation enters at the
// platform-neutral MessageEvent seam, which is what a balancing tool for #9 would reuse.
// Run: node prototype/architecture/simulate.ts

import type { ChatUserId, DomainEvent, EventBus, MemberFacts, MemberId, MessageEvent, WorkspaceId } from "./contracts.ts";
import { createKudosEngine, emptyTables } from "./engine.ts";
import { combinePerks, createEventBus, type Job } from "./events.ts";
import { createKudosParser, workspaceEmojiHook } from "./parser.ts";
import { buyInOrder, perkContributor, reduce, type PerkId, type ProgressionState } from "./progression-sketch.ts";

const WORKSPACE = "T1" as WorkspaceId;
const MONDAY = Date.UTC(2025, 9, 6, 10);
const DAY = 24 * 60 * 60 * 1000;

type Archetype = {
  user: string;
  plan(workday: number): Array<{ to: string[]; tacos: number; note: string }>;
  build: PerkId[];
};

const recipients = ["R1", "R2", "R3", "R4", "R5"];
const pick = (offset: number, count: number) => Array.from({ length: count }, (_, i) => recipients[(offset + i) % recipients.length] as string);

const archetypes: Record<string, Archetype> = {
  "thoughtful daily giver": {
    user: "UTHOUGHT",
    plan: (day) => [{ to: pick(day, 3), tacos: 1, note: "thanks for the careful review of the release plan" }],
    build: ["first-spark", "pocket-surprise", "three-cheers", "second-wind"],
  },
  "allowance maximiser": {
    user: "UMAX",
    plan: (day) => [
      { to: pick(day, 1), tacos: 3, note: "ty" },
      { to: pick(day + 1, 1), tacos: 2, note: "ty" },
    ],
    build: ["first-spark", "second-wind", "three-cheers", "pocket-surprise"],
  },
  "twice-a-week giver": {
    user: "UCASUAL",
    plan: (day) => (day % 5 === 1 || day % 5 === 3 ? [{ to: pick(day, 1), tacos: 1, note: "great pairing session on the flaky tests" }] : []),
    build: ["pocket-surprise", "first-spark", "three-cheers", "second-wind"],
  },
};

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const people = new Map<string, MemberFacts>(
  [...Object.values(archetypes).map((a) => a.user), ...recipients].map((user) => [user, { kind: "member", member: `m-${user}` as MemberId, timeZone: "UTC" }]),
);
const progression: ProgressionState = new Map();
const random = seeded(42);
const jobs: Job[] = [];
const stats = new Map<string, { overAllowance: number; given: number; drops: number }>();
const settings = { of: () => ({ baseAllowance: 3, kudosEmoji: "taco" }) };

const bus: EventBus = createEventBus(
  {
    kudosGiven: [
      { name: "progression", handle: (event) => republish(reduce(progression, event, random)) },
      { name: "jev assessor (stub)", handle: (event) => bus.publish({ type: "kudosAssessed", message: event.message, giver: event.giver, thoughtful: Number(event.annotations.noteWords) >= 4 }) },
    ],
    kudosAssessed: [{ name: "progression", handle: (event) => republish(reduce(progression, event, random)) }],
    quipDropped: [{ name: "stats", handle: (event) => statsOf(event.member).drops++ }],
  },
  (job) => jobs.push(job),
);

const engine = createKudosEngine({
  directory: { lookup: (_workspace, user) => people.get(user) },
  settings,
  parser: createKudosParser([
    workspaceEmojiHook(settings),
    { name: "note words", annotate: (content) => ({ noteWords: content.text.split(/\s+/).filter(Boolean).length }) },
  ]),
  perks: combinePerks([perkContributor(progression)]),
  feedback: { setIndicator: () => {}, replyPrivately: () => {} },
  events: bus,
  tables: emptyTables(),
});

function republish(events: DomainEvent[]) {
  events.forEach((event) => bus.publish(event));
}

function statsOf(member: string) {
  const key = member.replace(/^m-/, "");
  const entry = stats.get(key) ?? { overAllowance: 0, given: 0, drops: 0 };
  stats.set(key, entry);
  return entry;
}

let sequence = 0;
for (let workday = 0; workday < 20; workday++) {
  const at = MONDAY + (Math.floor(workday / 5) * 7 + (workday % 5)) * DAY;
  for (const archetype of Object.values(archetypes)) {
    for (const { to, tacos, note } of archetype.plan(workday)) {
      sequence += 1;
      const event: MessageEvent = {
        kind: "posted",
        ref: { workspace: WORKSPACE, conversation: "C1", message: `${at / 1000 + sequence}.000100` },
        author: archetype.user as ChatUserId,
        revision: BigInt(at) * 1000n + BigInt(sequence),
        at: at + sequence,
        content: {
          mentions: to.map((user) => ({ kind: "person" as const, user: user as ChatUserId })),
          emoji: Array.from({ length: tacos }, () => "taco"),
          text: note,
        },
      };
      const observation = engine.observe(event);
      if (observation.kind === "evaluated") {
        const entry = statsOf(archetype.user);
        if (observation.outcome.kind === "over-allowance") entry.overAllowance++;
        if (observation.outcome.kind === "given") entry.given += observation.outcome.awards.reduce((sum, a) => sum + a.kudos, 0);
      }
      while (jobs.length > 0) (jobs.shift() as Job).run();
      buyInOrder(progression, `m-${archetype.user}` as MemberId, archetype.build);
    }
  }
}

console.log("Four workweeks, seeded RNG 42. XP curve: L2 20, L3 100, then 50·(L−2)·(L−1). Base 10 XP given, 5 received.\n");
console.log("| Archetype | Kudos given | Over allowance | Level | XP | of which bonus | Quip drops | Perks | Unspent points |");
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |");
for (const [name, archetype] of Object.entries(archetypes)) {
  const member = progression.get(`m-${archetype.user}` as MemberId);
  const entry = statsOf(archetype.user);
  console.log(
    `| ${name} | ${entry.given} | ${entry.overAllowance} | ${member?.level} | ${member?.xp} | ${member?.bonusXp} | ${entry.drops} | ${[...(member?.perks ?? [])].join(", ")} | ${member?.skillPoints} |`,
  );
}
const received = recipients.map((user) => `${user} L${progression.get(`m-${user}` as MemberId)?.level}`).join(", ");
console.log(`\nRecipients: ${received}`);
