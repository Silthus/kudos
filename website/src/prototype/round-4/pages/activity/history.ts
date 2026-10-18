// PROTOTYPE (#625, round 4): four weeks of believable activity drawn from the album's people, with the album's live moments on top. Never merge to main.
import { useMemo } from "react";
import { useAlbum, type Hoggie, type Moment, type Person } from "../../../round-3/album";
import { fixtureNow, startOfWeek } from "./time";

const day = 86_400_000;

const hour = 3_600_000;

const oldestDay = 27;

const newestDay = 3;

const wordsYouGave = [
  "Thanks for jumping on the flaky deploy with me, I'd still be staring at logs without you.",
  "Your review caught the edge case I'd have shipped on Friday. Thank you for being so thorough.",
  "The way you walked the new joiners through the data model was brilliant.",
  "Thank you for picking up my on-call shift so I could get some sleep.",
  "Your sketches made the planning session click for everyone in the room.",
  "Thanks for the patient answers in my ask thread, it unblocked the whole release.",
  "You turned a messy customer question into the clearest doc I've read this year.",
  "Thank you for pairing on the migration, it went out without a single alert.",
  "Your demo had the whole team cheering. Thanks for the late nights on it.",
  "Thanks for noticing I was stuck and offering to help before I even asked.",
  "The retro you ran was the most honest one we've had. Thank you.",
  "You made the support queue feel calm on the busiest day of the month. Thanks.",
];

const wordsYouGot = [
  "Thanks for the thoughtful review on my first PR, I learned a lot.",
  "Your write-up of the outage made it so easy to follow. Thank you!",
  "Thank you for covering standup notes while I was out, the team loved them.",
  "You always make time to explain things properly. It means a lot.",
  "Thanks for the encouragement before my talk, it really helped.",
  "Your fix to the flaky test saved everyone hours this week.",
  "Thank you for the onboarding buddy sessions, I feel at home already.",
];

const hugger = "k:priya";

type Draw = () => number;

function drawFrom(seed: number): Draw {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pickFrom<Item>(items: readonly Item[], draw: Draw): Item {
  return items[Math.floor(draw() * items.length)]!;
}

function isWeekend(at: number) {
  const weekday = new Date(at).getUTCDay();
  return weekday === 0 || weekday === 6;
}

class Weeks {
  private packed = new Set<string>();

  take(person: string, at: number) {
    const slot = `${person}@${startOfWeek(at)}`;
    if (this.packed.has(slot)) return false;
    this.packed.add(slot);
    return true;
  }
}

function hoggieSlugs(found: Hoggie[]) {
  return found.filter(({ firstAt }) => firstAt !== null).map(({ hoggie }) => hoggie);
}

function firstPacksOf(collected: Person[], since: number, until: number, weeks: Weeks, hoggies: string[]): Moment[] {
  return collected
    .filter(({ collectedAt }) => collectedAt! >= since && collectedAt! <= until)
    .flatMap((person, index): Moment[] => {
      const openedAt = person.collectedAt! + (index % 5) * hour;
      const thankedAt = openedAt - (2 + (index % 4)) * hour;
      weeks.take(person.key, thankedAt);
      return [
        { kind: "thoughtful-given", at: thankedAt, person: person.key, message: wordsYouGave[index % wordsYouGave.length]!, packed: true },
        { kind: "pack-opened", at: openedAt, person: person.key, hoggie: hoggies[(index * 5) % hoggies.length]!, newPerson: true },
      ];
    });
}

function thanksOn(at: number, draw: Draw, collected: Person[], weeks: Weeks, hoggies: string[]): Moment[] {
  if (isWeekend(at) || draw() < 0.45) return [];
  const person = pickFrom(collected, draw);
  const message = pickFrom(wordsYouGave, draw);
  const packed = weeks.take(person.key, at);
  const thanked: Moment = { kind: "thoughtful-given", at, person: person.key, message, packed };
  if (!packed) return [thanked];
  return [thanked, { kind: "pack-opened", at: at + (1 + Math.floor(draw() * 4)) * hour, person: person.key, hoggie: pickFrom(hoggies, draw), newPerson: false }];
}

function thanksBackOn(at: number, draw: Draw, circle: Person[]): Moment[] {
  if (isWeekend(at) || draw() < 0.55) return [];
  return [{ kind: "thoughtful-received", at, person: pickFrom(circle, draw).key, message: pickFrom(wordsYouGot, draw) }];
}

function hugsOn(at: number, draw: Draw, circle: Person[], collected: Person[]): Moment[] {
  if (isWeekend(at)) return draw() < 0.2 ? [{ kind: "hug-received", at, person: hugger }] : [];
  const fromPriya: Moment[] = draw() < 0.5 ? [{ kind: "hug-received", at: at + 30 * 60_000, person: hugger }] : [];
  const received = Array.from({ length: Math.floor(draw() * 3) }, (_, index): Moment => ({ kind: "hug-received", at: at + (index + 2) * hour, person: pickFrom(circle, draw).key }));
  const given = Array.from({ length: Math.floor(draw() * 3) }, (_, index): Moment => ({ kind: "hug-given", at: at + (index + 1) * 50 * 60_000, person: pickFrom(collected, draw).key }));
  return [...fromPriya, ...received, ...given];
}

function circleOf(people: Person[], collected: Person[]) {
  const strangers = people.filter(({ collectedAt }) => collectedAt === null).filter((_, index) => index % 9 === 0);
  return [...collected, ...strangers];
}

function historyOf(people: Person[], found: Hoggie[]): Moment[] {
  const until = fixtureNow - (newestDay - 0.5) * day;
  const since = fixtureNow - oldestDay * day;
  const collected = people.filter(({ collectedAt }) => collectedAt !== null && collectedAt <= until);
  const circle = circleOf(people, collected);
  const weeks = new Weeks();
  const hoggies = hoggieSlugs(found);
  const firstPacks = firstPacksOf(collected, since, until, weeks, hoggies);
  const daily = Array.from({ length: oldestDay - newestDay + 1 }, (_, back) => newestDay + back).flatMap((daysAgo) => {
    const draw = drawFrom(daysAgo * 977);
    const morning = fixtureNow - daysAgo * day - 2 * hour;
    return [...thanksOn(morning + draw() * 6 * hour, draw, collected, weeks, hoggies), ...thanksBackOn(morning + draw() * 7 * hour, draw, circle), ...hugsOn(morning + draw() * 3 * hour, draw, circle, collected)];
  });
  return [...firstPacks, ...daily];
}

export function newestFirst(moments: Moment[]) {
  return moments.toSorted((first, second) => second.at - first.at);
}

export function useActivity() {
  const { album } = useAlbum();
  const history = useMemo(() => historyOf(album.people, album.hoggies), [album.people, album.hoggies]);
  const moments = useMemo(() => newestFirst([...album.moments, ...history]), [album.moments, history]);
  return { album, moments };
}
