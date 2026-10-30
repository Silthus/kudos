import { internalMutation } from "../../_generated/server";
import { hugGivenEventValidator } from "../../bus/events";
import { isMember } from "../../workspace/directory";
import { drawSecret } from "../hoggies/drops";
import { findsOnHug } from "../hoggies/draw";
import { earnHoggieItemCappedAtRare } from "../hoggies/rarityCaps";

export const findOnHug = internalMutation({
  args: { event: hugGivenEventValidator },
  handler: async (ctx, { event: { workspace, giver, message, day, at, rewards } }) => {
    if (rewards !== true || !(await isMember(ctx, giver))) return;
    if (!(await findsOnHug({ secret: drawSecret(), member: giver, hug: `${message.conversation}:${message.message}` }))) return;
    await earnHoggieItemCappedAtRare(ctx, { workspace, member: giver, key: `hug-find:${day}`, reason: { kind: "hug" }, earnedAt: at });
  },
});
