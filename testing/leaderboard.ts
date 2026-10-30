import { internal } from "../convex/_generated/api";
import { weekOf, type DayKey } from "../convex/engine/allowance";
import type { MemberId } from "../convex/workspace/directory";
import { kudosGivenEvent } from "./busEvents";
import type { Backend } from "./slackBackend";

export type CountedKudos = { kudos?: number; day: DayKey };

export type CountedHug = { day: DayKey; at?: number };

let messagesCounted = 0;

export async function kudosCounted(t: Backend, giver: MemberId, recipient: MemberId, { kudos = 1, day }: CountedKudos) {
  const message = aCountedMessage();
  const at = Date.parse(`${day}T12:00:00Z`);
  const award = await t.run((ctx) => ctx.db.insert("awards", { workspace: "T1", conversation: message.conversation, message: message.message, giver, recipient, kudos, day, at }));
  const event = kudosGivenEvent(giver, recipient, { message, awards: [{ award, giver, recipient, kudos }], day, at });
  await t.mutation(internal.leaderboard.totals.countKudosGiven, { event });
}

export async function hugCounted(t: Backend, giver: MemberId, person: MemberId, { day, at = Date.parse(`${day}T12:00:00Z`) }: CountedHug) {
  const message = aCountedMessage();
  await t.mutation(internal.leaderboard.hugs.countHugGiven, { event: { type: "hugGiven", workspace: "T1", giver, message, onKudos: false, author: person, at, day } });
  await t.mutation(internal.leaderboard.hugs.countHugReceived, { event: { type: "hugReceived", workspace: "T1", giver, person, message, at, week: weekOf(day).monday } });
}

function aCountedMessage() {
  messagesCounted += 1;
  return { workspace: "T1", conversation: "C1", message: `counted-${messagesCounted}` };
}
