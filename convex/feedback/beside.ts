import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { threadRootOf } from "../engine/engine";
import { messageRefValidator } from "../engine/messageEvent";
import type { MessagePlace } from "../messageSettings/kinds";
import { placeOf } from "../messageSettings/messageSettings";
import { messageKindOfNotification, notificationValidator } from "./notify";

export type Beside = { conversation: string; threadRoot?: string };

export type Destination = Beside | Exclude<MessagePlace, "channel">;

export const placeBesideTheKudos = internalQuery({
  args: { member: v.id("members"), notification: notificationValidator, kudos: messageRefValidator },
  handler: async (ctx, { member, notification, kudos }): Promise<Destination> => {
    const place = await placeOf(ctx, member, messageKindOfNotification(notification));
    if (place !== "channel") return place;
    const threadRoot = await threadRootOf(ctx, kudos);
    return { conversation: kudos.conversation, ...(threadRoot !== null && { threadRoot }) };
  },
});
