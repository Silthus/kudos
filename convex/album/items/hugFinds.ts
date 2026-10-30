import { internalMutation } from "../../_generated/server";
import { hugGivenEventValidator } from "../../bus/events";
import { isMember } from "../../workspace/directory";
import { drawSecret } from "../hoggies/drops";
import { findsOnHug } from "../hoggies/draw";
import { hugFindRarities } from "../hoggies/rarityCaps";
import { earnItem } from "./ledger";

export const findOnHug = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event: { workspace, giver, message, day, at, rewards } }) => {
    if (rewards !== true || !(await isMember(ctx, giver))) return;
    if (!(await findsOnHug({ secret: drawSecret(), member: giver, hug: `${message.conversation}:${message.message}` }))) return;
    await earnItem(ctx, { workspace, member: giver, source: "hoggie", key: `hug-find:${day}`, ...hugFindRarities, reason: { kind: "hug" }, earnedAt: at });
  },
});
