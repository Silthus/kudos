import { homeFacts } from "../engine/home";
import { everyoneBoardShownIn } from "../leaderboard/flag";
import { workspaceLink } from "../slack/workspaceLink";
import { followTheClock } from "./clock";
import { faceOf, type Face } from "./faces";
import { memberQuery, type Denial } from "./memberQuery";

export type { Face } from "./faces";

export type Kudos = { given: number; received: number };

export type MemberProfile = {
  kind: "member";
  name?: string;
  face: Face;
  kudosEmoji: string;
  allowance: { left: number; base: number; refillsAt: number };
  thisWeek: Kudos;
  lifetime: Kudos;
  chatUrl: string;
  leaderboard: "off" | "open";
};

export type MyProfile = Denial | MemberProfile;

export const getMyProfile = memberQuery(async (ctx, me): Promise<MemberProfile | Denial> => {
  await followTheClock(ctx);
  const facts = await homeFacts(ctx, me.workspace, me.user);
  if (facts?.kind !== "member") return { kind: "not-a-member" };
  return {
    kind: "member",
    ...(me.name !== undefined && { name: me.name }),
    face: await faceOf(ctx, me),
    kudosEmoji: facts.kudosEmoji,
    allowance: { left: facts.left, base: facts.base, refillsAt: facts.refillsAt },
    thisWeek: { given: facts.givenWeek, received: facts.receivedWeek },
    lifetime: { given: facts.given, received: facts.received },
    chatUrl: workspaceLink(me.workspace),
    leaderboard: (await everyoneBoardShownIn(ctx, me.workspace)) ? "open" : "off",
  };
});
