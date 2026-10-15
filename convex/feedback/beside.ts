import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { threadRootOf } from "../engine/engine";
import { messageRefValidator } from "../engine/messageEvent";
import { placeOf } from "../messageSettings/messageSettings";
import { messageKindOfNotification, notificationValidator } from "./notify";

export type Beside = { conversation: string; threadRoot?: string };

export const placeBesideTheKudos = internalQuery({
  args: { member: v.id("members"), notification: notificationValidator, kudos: messageRefValidator },
  handler: async (ctx, { member, notification, kudos }): Promise<Beside | null> => {
    if ((await placeOf(ctx, member, messageKindOfNotification(notification))) !== "channel") return null;
    const threadRoot = await threadRootOf(ctx, kudos);
    return { conversation: kudos.conversation, ...(threadRoot !== null && { threadRoot }) };
  },
});
