import { internal } from "../convex/_generated/api";
import type { DayKey } from "../convex/engine/allowance";
import type { MemberId } from "../convex/workspace/directory";
import { kudosGivenEvent } from "./busEvents";
import type { Backend } from "./slackBackend";

export type CountedKudos = { kudos?: number; day: DayKey };

let messagesCounted = 0;

export async function kudosCounted(t: Backend, giver: MemberId, recipient: MemberId, { kudos = 1, day }: CountedKudos) {
  messagesCounted += 1;
  const message = { workspace: "T1", conversation: "C1", message: `counted-${messagesCounted}` };
  const at = Date.parse(`${day}T12:00:00Z`);
  const award = await t.run((ctx) => ctx.db.insert("awards", { workspace: "T1", conversation: message.conversation, message: message.message, giver, recipient, kudos, day, at }));
  const event = kudosGivenEvent(giver, recipient, { message, awards: [{ award, giver, recipient, kudos }], day, at });
  await t.mutation(internal.leaderboard.totals.countKudosGiven, { event });
}
