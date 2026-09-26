import { ConvexError } from "convex/values";
import { fnv1a, mulberry32 } from "./random";
import { weekdayOfKey } from "./time";

/**
 * Synthetic load for the read-model scale proof (#30): a large workspace of fake members and
 * kudos, written straight into the source tables the way the demo seeder does. Dev only.
 *
 * The shape follows the research's assumptions (#3): ~50k kudos rows a year, ~190 on a working
 * day, quiet weekends; a skewed few give most; teams of ten thank each other most; a fifth of the
 * kudos are reactions; one channel in six is private. Everything is a pure function of the
 * member index and the day, so a seed can be rerun and compared.
 */

export const SCALE_TEAM = "T_SCALE_PROOF";
const TEAM_SIZE = 10;
const WEEKEND_ACTIVITY = 0.08;
/** A year's working-day equivalents: 261 weekdays plus the weekends' trickle. */
const ACTIVE_DAYS_PER_YEAR = 261 + 104 * WEEKEND_ACTIVITY;

const FIRST = ["Ana", "Ben", "Cleo", "Dev", "Emil", "Freya", "Gus", "Hana", "Ivo", "Jun", "Kira", "Lars", "Mona", "Nils", "Oona", "Pia", "Quinn", "Rui", "Sana", "Tomas", "Uma", "Vera", "Wim", "Xena", "Yara"];
const LAST = ["Adler", "Berg", "Costa", "Dahl", "Eriksen", "Fischer", "Garcia", "Hoffmann", "Ito", "Jansen", "Klein", "Lopez", "Meyer", "Novak", "Okafor", "Park", "Rossi", "Sato", "Tanaka", "Weber"];
const TITLES = ["Backend Engineer", "Frontend Engineer", "Product Designer", "Account Executive", "Customer Success Manager", "Data Scientist", "Site Reliability Engineer", "Product Manager", "Recruiter", "Support Engineer"];
const SHARED_CHANNELS = ["general", "engineering", "releases", "customer-love", "sales-wins", "design", "random", "incidents", "product", "support", "people-team", "shoutouts"];
const WORDS = ("thanks for the incredibly clear review on the migration plan and for staying late to get the release out " +
  "you saved the demo with that fix the customer wrote back to say it was the best support ever great pairing today " +
  "for mentoring the new joiners and untangling the billing mystery the dashboard looks stunning").split(" ");

export type ScalePerson = {
  slackUserId: string;
  name: string;
  title: string;
  avatarUrl: string;
  isAdmin: boolean;
  team: number;
  generosity: number; // relative giving weight: a skewed few give most
  popularity: number; // relative weight as a recipient outside the own team
};

export function scalePeople(count: number): ScalePerson[] {
  return Array.from({ length: count }, (_, i) => {
    const rand = mulberry32(fnv1a(`person:${i}`));
    const id = String(i + 1).padStart(4, "0");
    return {
      slackUserId: `USCALE${id}`,
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
      title: TITLES[Math.floor(rand() * TITLES.length)],
      avatarUrl: `https://avatars.slack-edge.com/2026-01-01/scale-proof-${id}_192.png`,
      isAdmin: i < 3,
      team: Math.floor(i / TEAM_SIZE),
      generosity: rand() ** 3 * 10 + 0.05, // heavy tail: ~a fifth of the people give half the kudos
      popularity: rand() * rand() * 4 + 0.2,
    };
  });
}

export type ScaleChannel = { id: string; name: string; private: boolean };

function channelsFor(people: ScalePerson[]): ScaleChannel[] {
  const teams = Math.ceil(people.length / TEAM_SIZE);
  return [
    ...SHARED_CHANNELS.map((name) => ({ id: `CSCALE_${name.toUpperCase().replace(/-/g, "_")}`, name, private: false })),
    ...Array.from({ length: teams }, (_, t) => ({ id: `CSCALE_TEAM_${t}`, name: `team-${t}`, private: t % 6 === 5 })),
  ];
}

export type ScaleMessage = {
  giver: number; // index into the people
  recipients: number[];
  amountEach: number;
  source: "message" | "reaction";
  channel: ScaleChannel;
  secondOfDay: number; // local time, office hours
  text: string;
  noteWords?: number;
};

/** Cumulative weights for picking by weight in O(log n). */
function picker(weights: number[]) {
  const cumulative: number[] = [];
  let total = 0;
  for (const w of weights) cumulative.push((total += w));
  return (r: number) => {
    const x = r * total;
    let [lo, hi] = [0, cumulative.length - 1];
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] > x) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
}

/** A day's kudos messages: ~kudosPerYear / 270 rows on a weekday, with no giver over `dailyLimit`. */
export function planDay(day: string, people: ScalePerson[], kudosPerYear: number, dailyLimit: number, emojiName: string): ScaleMessage[] {
  const rand = mulberry32(fnv1a(`day:${day}`));
  const weekend = weekdayOfKey(day) >= 5;
  const target = Math.round((kudosPerYear / ACTIVE_DAYS_PER_YEAR) * (weekend ? WEEKEND_ACTIVITY : 1) * (0.8 + 0.4 * rand()));
  const pickGiver = picker(people.map((p) => p.generosity));
  const pickAnyone = picker(people.map((p) => p.popularity));
  const channels = channelsFor(people);
  const used = new Array<number>(people.length).fill(0);
  const out: ScaleMessage[] = [];
  let rows = 0;
  for (let attempts = 0; rows < target && attempts < target * 20; attempts++) {
    const giver = pickGiver(rand());
    const budget = dailyLimit - used[giver];
    if (budget < 1) continue;
    const reaction = rand() < 0.2;
    const wanted = reaction ? 1 : rand() < 0.75 ? 1 : rand() < 0.8 ? 2 : 3;
    const recipients: number[] = [];
    for (let tries = 0; recipients.length < wanted && tries < 20; tries++) {
      const team = people[giver].team;
      const r = rand() < 0.7 ? Math.min(people.length - 1, team * TEAM_SIZE + Math.floor(rand() * TEAM_SIZE)) : pickAnyone(rand());
      if (r !== giver && !recipients.includes(r)) recipients.push(r);
    }
    if (recipients.length === 0) continue;
    const amountEach = Math.min(reaction ? 1 : 1 + Math.floor(rand() * rand() * 3), Math.floor(budget / recipients.length));
    if (amountEach < 1) continue;
    const channel = rand() < 0.5 ? channels[SHARED_CHANNELS.length + people[giver].team] : channels[Math.floor(rand() * SHARED_CHANNELS.length)];
    const note = Array.from({ length: Math.floor(rand() * 15) }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(" ");
    const mentions = recipients.map((r) => `<@${people[r].slackUserId}>`).join(" ");
    out.push({
      giver,
      recipients,
      amountEach,
      source: reaction ? "reaction" : "message",
      channel,
      secondOfDay: (8 + Math.floor(rand() * 10)) * 3600 + Math.floor(rand() * 3600),
      text: `${mentions} ${`:${emojiName}:`.repeat(amountEach)} ${note}`.trim(),
      ...(reaction ? {} : { noteWords: note ? note.split(" ").length : 0 }),
    });
    used[giver] += amountEach * recipients.length;
    rows += recipients.length;
  }
  return out;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "0.0.0.0"]);

/** True only for a backend on this machine (`npx convex dev` with a local deployment). */
export function isLocalDeployment(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Refuse unless this deployment is a local backend; fails closed when the URL is unknown. */
export function assertLocalDeployment() {
  if (!isLocalDeployment(process.env.CONVEX_CLOUD_URL)) {
    throw new ConvexError("The scale-proof seed only runs on a local backend (npx convex dev with a local deployment).");
  }
}
